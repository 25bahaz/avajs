import { defineChain } from "viem";

export const SERVER_URL = "http://127.0.0.1";
export const NODEJS_RPC_URL = `${SERVER_URL}:9654/ext/bc/ody4XoWhFZQ4hYfNVaBLSpso7N2LamPjaMSSVtXaQXUs9BZ66/rpc`;

export const SIGGNATURE_AGGREGATOR_URL = `${SERVER_URL}:9090`;

export const REGISTER_VALIDATOR_WARP_MESSAGE_TOPIC = "0x56600c567728a800c0aa927500f831cb451df66a7af570eb4df4dfbf4674887d"
export const REMOVAL_VALIDATOR_WARP_MESSAGE_TOPIC = ""
export const SUBNET_ID = "2W9boARgCWL25z6pMFNtkCfNA5v28VGg9PmBgUJfuKndEdhrvw";
export const WARP_PRECOMPILE_ADDRESS = "0x0200000000000000000000000000000000000005"

export const QUORUM_PERCENTAGE = 67;
export const NODEJS_ID = 123987;

export const NODEJS = defineChain({
    id: NODEJS_ID,
    name: 'nodejs',
    nativeCurrency: {
        decimals: 18,
        name: 'TTT Token',
        symbol: 'TTT'
    },
    rpcUrls: {
        default: {
            http: [NODEJS_RPC_URL]
        }
    }
})