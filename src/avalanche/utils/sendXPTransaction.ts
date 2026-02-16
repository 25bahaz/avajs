import { AvalancheWalletCoreClient, PChainRpcSchema } from "@avalanche-sdk/client";
import { IssueTxParameters, IssueTxReturnType } from "@avalanche-sdk/client/methods/pChain";
import { Chain, Transport } from "viem";
import {
    type Hex,
} from "viem";
import {
    AvalancheWalletRpcSchema,
    SendXPTransactionParameters,
    SendXPTransactionReturnType,
    signXPTransaction
} from "@avalanche-sdk/client/methods/wallet";
import { parseAvalancheAccount } from "@avalanche-sdk/client/accounts";
import { issueTx as issueTxPChain } from "@avalanche-sdk/client/methods/pChain";
import { type Context as ContextNamespace, utils } from "@avalabs/avalanchejs";
import { FeeConfig } from "@avalabs/avalanchejs/dist/vms/pvm";

export type Context = {
    readonly networkID: number;
    readonly hrp: string;
    readonly xBlockchainID: string;
    readonly pBlockchainID: string;
    readonly cBlockchainID: string;
    readonly avaxAssetID: string;
    readonly baseTxFee: bigint;
    readonly createAssetTxFee: bigint;
    readonly platformFeeConfig: FeeConfig;
};

export async function issueTx<chain extends Chain | undefined>(
    client: AvalancheWalletCoreClient,
    params: IssueTxParameters
): Promise<IssueTxReturnType> {
    return client.request<
        PChainRpcSchema,
        {
            method: "platform.issueTx";
            params: IssueTxParameters;
        },
        IssueTxReturnType
    >({
        method: "platform.issueTx",
        params,
    });
}

export async function sendXPTransaction(
    client: AvalancheWalletCoreClient,
    params: SendXPTransactionParameters,
    context: Context
): Promise<SendXPTransactionReturnType> {
    const {
        tx: txOrTxHex,
        chainAlias,
        account,
        utxoIds,
        subnetAuth,
        subnetOwners,
        disableOwners,
        disableAuth,
        ...rest
    } = params;

    const paramAc = parseAvalancheAccount(account);
    const xpAccount = paramAc?.xpAccount || client.xpAccount;

    if (xpAccount) {
        let signedTxRes = await signXPTransaction(client, {
            tx: txOrTxHex,
            chainAlias,
            subnetOwners,
            subnetAuth,
            disableOwners,
            disableAuth,
            context
        });

        const issueTx = (args: any) => {
            return issueTxPChain(client.pChainClient, args);
        };

        const issueTxResponse = await issueTx({
            tx: signedTxRes.signedTxHex,
            encoding: "hex",
        });

        return {
            txHash: issueTxResponse.txID as Hex,
            chainAlias,
        };
    }

    const response = await client.request<
        AvalancheWalletRpcSchema,
        {
            method: "avalanche_sendTransaction";
            params: Omit<
                SendXPTransactionParameters,
                | "account"
                | "tx"
                | "utxoIds"
                | "subnetAuth"
                | "subnetOwners"
                | "disableOwners"
                | "disableAuth"
            > & {
                transactionHex: string;
                utxos: string[] | undefined;
            };
        },
        string
    >({
        method: "avalanche_sendTransaction",
        params: {
            externalIndices: rest.externalIndices,
            internalIndices: rest.internalIndices,
            feeTolerance: rest.feeTolerance,
            transactionHex:
                typeof txOrTxHex === "string"
                    ? txOrTxHex
                    : utils.bufferToHex(txOrTxHex.toBytes()),
            chainAlias,
            utxos: utxoIds,
        },
    });

    return {
        txHash: response,
        chainAlias,
    };
}