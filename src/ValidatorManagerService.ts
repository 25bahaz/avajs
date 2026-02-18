import {
  privateKeyToAvalancheAccount,
  type AvalancheAccount,
} from "@avalanche-sdk/client/accounts";
// Justification is fetched from L1 logs, not P-Chain API
import {
  bytesToHex,
  decodeAbiParameters,
  getContract,
  hexToBytes,
  http,
  toHex,
  TransactionReceipt,
  type GetContractReturnType,
  type Hex,
} from "viem";
import { VALIDATOR_MANAGER_ABI } from "./abi/VALIDATOR_MANAGER_ABI";
import {
  createTakaschainWalletClient,
  type TakaschainWalletClient,
} from "./avalanche/index";
import { aggregateSignature } from "./avalanche/signature-aggregator";
import { packL1ValidatorRegistration } from "./avalanche/utils/convertWarp";
import { parseNodeID } from "./avalanche/utils/ids";
import { packWarpIntoAccessList } from "./avalanche/utils/packWarp";
import {
  REGISTER_VALIDATOR_WARP_MESSAGE_TOPIC,
  REMOVAL_VALIDATOR_WARP_MESSAGE_TOPIC,
  SUBNET_ID,
  NODEJS,
  WARP_PRECOMPILE_ADDRESS,
} from "./constants";
import { AvalancheWalletClient, createAvalancheWalletClient } from "@avalanche-sdk/client";
import { Avalanche } from "@avalanche-sdk/chainkit";
import { avalanche } from '@avalanche-sdk/client/chains'
import { avaxToNanoAvax } from '@avalanche-sdk/client/utils'
import { getHRP } from "./avalanche/methods/registerL1Validator";
import { Context, sendXPTransaction } from "./avalanche/utils/sendXPTransaction";
import { GetRegistrationJustification } from "./avalanche/utils/justification";

export type getCurrentValidatorsResponse = {
  result: {
    validators: any[]
  }
}

export class ValidatorManagerService {
  public validatorManagerAccount: AvalancheAccount;
  public walletClient: TakaschainWalletClient;
  public pClient: AvalancheWalletClient;
  public validatorProxyContract: GetContractReturnType<
    typeof VALIDATOR_MANAGER_ABI,
    TakaschainWalletClient
  >;

  constructor() {
    this.validatorManagerAccount = privateKeyToAvalancheAccount(
      "0x56289e99c94b6912bfc12adc093c9b51124f0dc54ac7a766b2bc5ccf558d8027",
    );
    this.walletClient = createTakaschainWalletClient(
      this.validatorManagerAccount,
    );
    this.pClient = createAvalancheWalletClient({
      account: this.validatorManagerAccount,
      chain: NODEJS,
      transport: {
        type: "http",
        url: "http://127.0.0.1:9650/ext/P",
      },
    })
    this.validatorProxyContract = getContract({
      address: "0x0Feedc0de0000000000000000000000000000000",
      abi: VALIDATOR_MANAGER_ABI,
      client: this.walletClient,
    });
  }

  /**
   * Get the justification (RegisterL1ValidatorMessage payload) from L1 logs.
   * This is the warp message emitted during initiateValidatorRegistration.
   * The justification is the inner payload that hashes to the validationId.
   */
  private async getRegistrationJustificationFromLogs(validationId: Hex): Promise<Uint8Array> {
    const { sha256 } = await import('@noble/hashes/sha256');

    // Get logs from the warp precompile using raw RPC call
    const logs = await this.walletClient.request({
      method: 'eth_getLogs',
      params: [{
        address: WARP_PRECOMPILE_ADDRESS,
        fromBlock: '0x0',
        toBlock: 'latest'
      }]
    }) as Array<{ data: string, topics: string[] }>;

    console.log(`Found ${logs.length} warp logs`);

    // Find the log whose payload hashes to our validationId
    for (const log of logs) {
      // Decode ABI-encoded bytes from log.data
      // Format: offset(32) + length(32) + data
      const dataHex = log.data.slice(2); // remove 0x
      const dataLen = parseInt(dataHex.slice(64, 128), 16); // read length at offset 32
      const unsignedMessage = dataHex.slice(128, 128 + dataLen * 2); // actual message bytes

      const msgBuf = Buffer.from(unsignedMessage, 'hex');

      // Parse unsigned warp message to get the inner payload
      // Structure: codecID(2) + networkID(4) + sourceChainID(32) + messageLen(4) + addressedCall
      let offset = 2 + 4 + 32; // skip codec, network, sourceChain
      const msgLen = msgBuf.readUInt32BE(offset); offset += 4;
      const addressedCall = msgBuf.slice(offset, offset + msgLen);

      // Parse AddressedCall: codecID(2) + typeID(4) + srcAddrLen(4) + srcAddr + payloadLen(4) + payload
      let acOffset = 2 + 4; // skip codec, typeID
      const srcAddrLen = addressedCall.readUInt32BE(acOffset); acOffset += 4;
      acOffset += srcAddrLen; // skip source address
      const payloadLen = addressedCall.readUInt32BE(acOffset); acOffset += 4;
      const payload = addressedCall.slice(acOffset, acOffset + payloadLen);

      // Hash the payload to see if it matches our validationId
      const payloadHash = Buffer.from(sha256(payload)).toString('hex');
      const expectedHash = validationId.slice(2).toLowerCase(); // remove 0x prefix

      console.log(`Log payload hash: ${payloadHash}, expected: ${expectedHash}`);

      if (payloadHash === expectedHash) {
        console.log('Found matching justification, payload length:', payload.length);
        return new Uint8Array(payload);
      }
    }

    throw new Error(`No justification log found for validationId ${validationId}`);
  }
  public async getCurentValidatorListFromSubnet(subnetId: any) {
    const res = await fetch("http://127.0.0.1:9650/ext/bc/P", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "platform.getCurrentValidators",
        params: {
          subnetID: subnetId,
        },
      }),
    });

    const data = await res.json() as getCurrentValidatorsResponse;
    const validators = data?.result?.validators;

    console.log("Validators found:", validators?.length);

    if (validators?.length === 0) {
      console.error(
        "STOP: P-Chain sees 0 validators. RegisterL1ValidatorTx will fail."
      );
    }

    return validators;
  }
  public async getPChainHeight() {
    const res = await fetch("http://127.0.0.1:9650/ext/P", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "platform.getHeight",
      }),
    });

    const data = await res.json();

    if (!data) {
      console.error(
        "STOP: P-Chain sees 0 validators. RegisterL1ValidatorTx will fail."
      );
    }

    return data;
  }
  public async sendDummyPChainTx() {
    const client = createAvalancheWalletClient({
      account: this.validatorManagerAccount,
      chain: NODEJS,
      transport: {
        type: "http",
        url: "http://127.0.0.1:9650/ext/P",
      },
    })
    const context: Context = {
      networkID: 1337,
      hrp: getHRP(1337),  // Local networks use "custom" HRP
      xBlockchainID: "2XYkjHB237QcS4SjzuZZekcpFXXQDXYdVg7zqdwURV78XQcu3C",
      pBlockchainID: "11111111111111111111111111111111LpoYY",
      cBlockchainID: "5T24nSPnQ4WWiW5uC3SLYovGVRTNK9GRxXdHH5AoShGp1bR71",
      avaxAssetID: "2kEMnZxZ6LXjVww7Mo4YgDo6o95igTmXvsT6k1aahmAscPMXTg",
      baseTxFee: 1000000n,           // 0.001 AVAX
      createAssetTxFee: 1000000n,    // 0.001 AVAX
      platformFeeConfig: {
        weights: [1, 1000, 1000, 4],
        maxCapacity: 1000000n,
        maxPerSecond: 100000n,
        targetPerSecond: 50000n,
        minPrice: 1n,
        excessConversionConstant: 2164043n
      }
    };

    const baseTx = await client.pChain.prepareBaseTxn({
      outputs: [{
        addresses: ["P-custom18jma8ppw3nhx5r4ap8clazz0dps7rv5u9xde7p"],
        amount: avaxToNanoAvax(1),
      }],
      context
    })

    const res = await sendXPTransaction(client.pChain, {
      tx: baseTx.tx,
      chainAlias: 'P'
    }, context)
    console.log(res);

  }
  //* -------------- VALIDATOR REGISTRATION -------------- *//
  public async registerValidator(
    nodeId: string,
    blsPublicKey: Hex,
    proofOfPossession: Hex,
    weight: bigint,
    remainingBalanceOwner: Hex,
    deactivationOwner: Hex,
  ) {
    this.initiateValidatorRegistration(
      nodeId,
      blsPublicKey,
      weight,
      remainingBalanceOwner,
      deactivationOwner,
    )
      .then((initiateRegistrationTxHash) => {
        this.submitPChainTxRegisterValidator(
          initiateRegistrationTxHash,
          weight,
          proofOfPossession,
        )
          .then((pChainTxHash) => {
            this.completeValidatorRegistration(pChainTxHash).catch((err) =>
              console.error("Error completeValidatorRegistration " + err),
            );
          })
          .catch((err) =>
            console.error("Error submitPChainTxRegisterValidator " + err),
          );
      })
      .catch((err) =>
        console.error("Error initiateValidatorRegistration " + err),
      );
  }

  public async initiateValidatorRegistration(
    nodeId: string,
    blsPublicKey: Hex,
    weight: bigint,
    remainingBalanceOwner: Hex,
    deactivationOwner: Hex,
  ): Promise<Hex> {
    const args = [
      parseNodeID(nodeId) as Hex,
      blsPublicKey,
      { threshold: 1, addresses: [remainingBalanceOwner] },
      { threshold: 1, addresses: [deactivationOwner] },
      weight,
    ] as const;

    const initValRegTxHash = await this.validatorProxyContract.write.initiateValidatorRegistration(
      args,
      { account: this.validatorManagerAccount.evmAccount, chain: NODEJS },
    );
    return initValRegTxHash;
  }

  public async submitPChainTxRegisterValidator(
    txHash: Hex,
    balance: bigint,
    blsProofOfPossession: Hex,
  ): Promise<Hex> {
    const receipt = await this.walletClient.waitForTransactionReceipt({
      hash: txHash,
    });

    if (receipt.status === "reverted") {
      throw new Error("Transaction reverted");
    }

    const warpEventLog = receipt.logs.find((log) => {
      return (
        log &&
        log.address &&
        log.address.toLowerCase() === WARP_PRECOMPILE_ADDRESS.toLowerCase() &&
        log.topics &&
        log.topics[0] &&
        log.topics[0].toLowerCase() ===
        REGISTER_VALIDATOR_WARP_MESSAGE_TOPIC.toLowerCase()
      );
    });

    if (warpEventLog && warpEventLog.data) {
      // The log.data is ABI-encoded bytes - we need to decode it to get the actual warp message
      const [decodedWarpMessageBytes] = decodeAbiParameters(
        [{ type: 'bytes' }],
        warpEventLog.data
      );
      const unsignedWarpMessage: Hex = decodedWarpMessageBytes as Hex;

      console.log('Step 2 - unsignedWarpMessage (decoded):', unsignedWarpMessage.substring(0, 100) + '...');
      console.log('Step 2 - unsignedWarpMessage length:', unsignedWarpMessage.length);

      const pChainHeight: any = await this.getPChainHeight();
      const aggregatorResult = await aggregateSignature({ message: unsignedWarpMessage, pChainHeight: Number(pChainHeight.result.height) });
      console.log('Step 2 - aggregatorResult:', aggregatorResult);

      const pChainTxHash = await this.walletClient.registerL1Validator({
        balance,
        blsProofOfPossession: blsProofOfPossession,
        signedWarpMessage: `0x${aggregatorResult.signedMessage}`,
      });

      return pChainTxHash as Hex;
    } else {
      throw new Error("Warp event log couldn't be found");
    }
  }

  /**
   * Complete validator registration by submitting the P-Chain acknowledgment to L1.
   * @param pChainTxHash - The P-Chain transaction hash from registerL1Validator
   * @param messageIndex - Index of the warp message in the access list (default: 0, which is correct for single-message transactions)
   */
  public async completeValidatorRegistration(pChainTxHash: string, messageIndex: number = 0): Promise<TransactionReceipt> {
    const registrationMessageData =
      await this.walletClient.extractRegisterL1ValidatorMessage({
        txId: pChainTxHash,
      });

    const nodeId = (
      registrationMessageData.nodeID.startsWith("0x")
        ? registrationMessageData.nodeID
        : `0x${registrationMessageData.nodeID}`
    ) as Hex;

    console.log('nodeId for getNodeValidationID:', nodeId);
    const validationId = await this.validatorProxyContract.read.getNodeValidationID([nodeId]);
    console.log('validationId from contract:', validationId);

    if (
      validationId ===
      "0x0000000000000000000000000000000000000000000000000000000000000000"
    ) {
      throw new Error(
        "No validation ID found for this node. The validator may not be registered yet.",
      );
    }

    const validationIDBytes = hexToBytes(validationId);

    const l1ValidatorRegistrationMessage = packL1ValidatorRegistration(
      validationIDBytes,
      true, // registered = true to acknowledge successful registration
      1337,
      "11111111111111111111111111111111LpoYY", // always use P-Chain ID
    );
    // Get justification from L1 chain logs (the InitiateValidatorRegistration event)
    const justificationBytes = await GetRegistrationJustification(
      validationId,           // validationIDHex: the validation ID as hex string
      SUBNET_ID,              // subnetIDStr: the subnet ID
      this.walletClient       // publicClient: has getBlockNumber() and getLogs()
    );

    if (!justificationBytes) {
      throw new Error(`Failed to get justification for validationId ${validationId}`);
    }

    const justification = justificationBytes;

    console.log('l1ValidatorRegistrationMessage', bytesToHex(l1ValidatorRegistrationMessage));
    console.log('justification from logs', bytesToHex(justification));
    
    // Use subnet validators to sign (like the Avalanche website does)
    const pChainHeight: any = await this.getPChainHeight();
    console.log("------- aggregator block height -------: ", pChainHeight.result.height)
    const aggregatorResult = await aggregateSignature({
      message: bytesToHex(l1ValidatorRegistrationMessage),
      justification: bytesToHex(justification),
      signingSubnetId: SUBNET_ID,  // Use subnet validators
      pChainHeight: Number(pChainHeight.result.height),
    });
    await new Promise(r => setTimeout(r, 10000));
    console.log('aggregatorResult.signedMessage:', aggregatorResult.signedMessage);
    const signedPChainWarpMsgBytes = hexToBytes(`0x${aggregatorResult.signedMessage}`);
    console.log('signedPChainWarpMsgBytes length:', signedPChainWarpMsgBytes.length);
    const accessList = packWarpIntoAccessList(signedPChainWarpMsgBytes);
    console.log('accessList:', JSON.stringify(accessList, null, 2));
    console.log(`Using warp message index: ${messageIndex} (should be 0 for single-message transactions)`);

    console.log('📤 Preparing transaction data...');

    // Encode the function call manually
    const { encodeFunctionData } = await import('viem');
    const data = encodeFunctionData({
      abi: VALIDATOR_MANAGER_ABI,
      functionName: 'completeValidatorRegistration',
      args: [messageIndex]
    });
    console.log('Encoded data:', data);

    // Prepare transaction request
    const txRequest = {
      account: this.validatorManagerAccount.evmAccount,
      to: this.validatorProxyContract.address,
      data: data as `0x${string}`,
      chain: NODEJS,
      accessList: accessList,
      gas: 8000000n,
      maxFeePerGas: 25000000000n,
      maxPriorityFeePerGas: 1000000000n,
    };

    console.log('Transaction request prepared:', {
      to: txRequest.to,
      from: txRequest.account.address,
      gas: txRequest.gas.toString(),
      accessList: txRequest.accessList
    });

    // Send the transaction using walletClient directly
    console.log('Sending raw transaction...');
    const txHash = await this.walletClient.sendTransaction(txRequest);

    console.log('✅ Transaction sent! Hash:', txHash);

    // Quick check - does the transaction exist?
    console.log('Verifying transaction was broadcast...');
    try {
      const sentTx = await this.walletClient.getTransaction({ hash: txHash });
      console.log('✅ Transaction found in mempool/chain:', {
        blockNumber: sentTx.blockNumber,
        blockHash: sentTx.blockHash,
        from: sentTx.from,
        to: sentTx.to
      });
    } catch (err: any) {
      console.error('❌ WARNING: Transaction not found immediately after sending!', err?.message);
    }

    console.log('⏳ Waiting for transaction receipt for tx:', txHash);

    const receipt = await this.walletClient.waitForTransactionReceipt({
      hash: txHash,
      timeout: 60_000, // 60 second timeout
    });

    console.log('Receipt received:', {
      status: receipt.status,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
      transactionHash: receipt.transactionHash
    });

    if (receipt.status === "success") {
      console.log("✅ Validator registration completed successfully!");
      return receipt;
    } else {
      console.error("❌ Transaction reverted. Receipt:", receipt);
      throw new Error("Validator registration transaction reverted");
    }
  }
}