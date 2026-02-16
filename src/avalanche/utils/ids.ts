import { utils } from "@avalabs/avalanchejs";
import { fromBytes } from "viem";

export const parseNodeID = (nodeID: string): string => {
    const nodeIDWithoutPrefix = nodeID.replace("NodeID-", "");
    const decodeID = utils.base58.decode(nodeIDWithoutPrefix);
    const nodeIDHex = fromBytes(decodeID, 'hex');
    const nodeIDHexTrimmed = nodeIDHex.slice(0, -8);
    return nodeIDHexTrimmed;
}