import { createWalletClient, http } from "viem"
import { NODEJS, NODEJS_RPC_URL } from "../constants"
import { AvalancheAccount } from "@avalanche-sdk/client/accounts"
import { AvalancheWalletClient, createAvalancheWalletClient } from "@avalanche-sdk/client";
import { registerL1Validator, RegisterL1ValidatorParams } from "./methods/registerL1Validator";
import { extractRegisterL1ValidatorMessage, ExtractRegisterL1ValidatorMessageParams, ExtractRegisterL1ValidatorMessageResponse } from "./methods/extractRegisterL1ValidatorMessage";

export type TakaschainWalletClient = Omit<AvalancheWalletClient, 'addChain'> & {
    registerL1Validator: (args: RegisterL1ValidatorParams) => Promise<string>;
    extractRegisterL1ValidatorMessage: (args: ExtractRegisterL1ValidatorMessageParams) => Promise<ExtractRegisterL1ValidatorMessageResponse>;
};

export function createTakaschainWalletClient(_account: AvalancheAccount): TakaschainWalletClient {
    
    const baseClient = createAvalancheWalletClient({
        chain: NODEJS,
        transport: {
            type: 'http'
        },
        account: _account
    });

    // Add all custom methods at root level
    const clientWithCustomMethods = {
        ...baseClient,
        registerL1Validator: (args: RegisterL1ValidatorParams) => registerL1Validator(baseClient, args),
        extractRegisterL1ValidatorMessage: (args: ExtractRegisterL1ValidatorMessageParams) => extractRegisterL1ValidatorMessage(baseClient, args)

    };

    return clientWithCustomMethods as TakaschainWalletClient;
}