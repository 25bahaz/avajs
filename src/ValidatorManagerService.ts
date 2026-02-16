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

export class ValidatorManagerService {
  public validatorManagerAccount: AvalancheAccount;
  public walletClient: TakaschainWalletClient;
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
    weight: bigint,
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

      const aggregatorResult = await aggregateSignature({ message: unsignedWarpMessage });
      console.log('Step 2 - aggregatorResult:', aggregatorResult);

      // Add 0x prefix directly - do NOT use toHex() which would convert ASCII to hex
      const signedWarpMessage = aggregatorResult.signedMessage.startsWith('0x') 
        ? aggregatorResult.signedMessage 
        : `0x${aggregatorResult.signedMessage}` as Hex;
      
      const pChainTxHash = await this.walletClient.registerL1Validator({
        balance: weight,
        blsProofOfPossession: blsProofOfPossession,
        signedWarpMessage: signedWarpMessage,
      });

      return pChainTxHash as Hex;
    } else {
      throw new Error("Warp event log couldn't be found");
    }
  }

  public async completeValidatorRegistration(pChainTxHash: string): Promise<TransactionReceipt> {
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
    const justification = await this.getRegistrationJustificationFromLogs(validationId);

    console.log('l1ValidatorRegistrationMessage', bytesToHex(l1ValidatorRegistrationMessage));
    console.log('justification from logs', bytesToHex(justification));
    // Use subnet validators to sign (like the Avalanche website does)
    const aggregatorResult = await aggregateSignature({
      message: bytesToHex(l1ValidatorRegistrationMessage),
      justification: bytesToHex(justification),
      signingSubnetId: SUBNET_ID,  // Use subnet validators
    });
    console.log('aggregatorResult.signedMessage:', aggregatorResult.signedMessage);
    const signedPChainWarpMsgBytes = hexToBytes(`0x${aggregatorResult.signedMessage}`);
    console.log('signedPChainWarpMsgBytes length:', signedPChainWarpMsgBytes.length);
    const accessList = packWarpIntoAccessList(signedPChainWarpMsgBytes);
    console.log('accessList:', JSON.stringify(accessList, null, 2));

    const txHash =
      await this.validatorProxyContract.write.completeValidatorRegistration(
        [0],
        {
          account: this.validatorManagerAccount.evmAccount,
          chain: NODEJS,
          accessList: accessList,
        },
      );

    const receipt = await this.walletClient.waitForTransactionReceipt({
      hash: txHash,
    });

    console.log('receipt', receipt);

    if (receipt.status === "success") {
      console.log("Validator registration completed successfully!");
      return receipt;
    } else {
      throw new Error("Validator registration failed");
    }
  }
}