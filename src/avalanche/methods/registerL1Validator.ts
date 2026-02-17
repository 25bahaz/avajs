import { AvalancheWalletClient, AvalancheWalletCoreClient, Chain, createAvalancheWalletClient, Hex } from "@avalanche-sdk/client"

import { privateKeyToAvalancheAccount } from "@avalanche-sdk/client/accounts";
import { sendXPTransaction, Context } from "../utils/sendXPTransaction";

export const MainnetName = "mainnet";
export const CascadeName = "cascade";
export const DenaliName = "denali";
export const EverestName = "everest";
export const FujiName = "fuji";
export const TestnetName = "testnet";
export const UnitTestName = "testing";
export const LocalName = "local";

export const MainnetID = 1;
export const CascadeID = 2;
export const DenaliID = 3;
export const EverestID = 4;
export const FujiID = 5;

export const TestnetID = FujiID;
export const UnitTestID = 10;
export const LocalID = 12345;

export const MainnetHRP = "avax";
export const CascadeHRP = "cascade";
export const DenaliHRP = "denali";
export const EverestHRP = "everest";
export const FujiHRP = "fuji";
export const UnitTestHRP = "testing";
export const LocalHRP = "local";
export const FallbackHRP = "custom";

export const NetworkIDToHRP = {
  [MainnetID]: MainnetHRP,
  [CascadeID]: CascadeHRP,
  [DenaliID]: DenaliHRP,
  [EverestID]: EverestHRP,
  [FujiID]: FujiHRP,
  [UnitTestID]: UnitTestHRP,
  [LocalID]: LocalHRP,
};

export const getHRP = (networkID: number): string => {
  return (
    NetworkIDToHRP[networkID as keyof typeof NetworkIDToHRP] ?? FallbackHRP
  );
}



export type RegisterL1ValidatorParams = {
  balance: bigint,
  blsProofOfPossession: Hex,
  signedWarpMessage: Hex
}

export async function registerL1Validator(client: AvalancheWalletClient, params: RegisterL1ValidatorParams): Promise<string> {
  const { balance, blsProofOfPossession, signedWarpMessage } = params;

  const blsSignature = blsProofOfPossession.startsWith("0x") ? blsProofOfPossession : `0x${blsProofOfPossession}`;

  const message = signedWarpMessage.startsWith("0x") ? signedWarpMessage : `0x${signedWarpMessage}`;

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

  const _account = privateKeyToAvalancheAccount(
    "0x56289e99c94b6912bfc12adc093c9b51124f0dc54ac7a766b2bc5ccf558d8027",
  );

  const pClient = createAvalancheWalletClient({
    account: _account,
    transport: {
      type: "http",
      url: "http://127.0.0.1:9650/ext/P",
    }
  })
  console.log("message", message);
  console.log("blsSignature", blsSignature);
  console.log("balance", balance);
  console.log("context", context);
  const txnRequest = await pClient.pChain.prepareRegisterL1ValidatorTxn({
    initialBalanceInAvax: balance,
    blsSignature: blsSignature,
    message: message,
    context: context as any
  });

  const result = await sendXPTransaction(pClient.pChain, {
    tx: txnRequest.tx,
    chainAlias: 'P'
  }, context);

  return result.txHash;
}
