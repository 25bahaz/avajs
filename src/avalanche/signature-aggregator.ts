import { Avalanche } from "@avalanche-sdk/chainkit";
import { QUORUM_PERCENTAGE, SUBNET_ID, SIGGNATURE_AGGREGATOR_URL } from "../constants";


interface SignatureAggregationParams {
    message: string,
    justification?: string,
    signingSubnetId?: string,
    quorumPercentage?: number
}

interface SignatureAggregationResponse {
    'signed-message': string;
}

interface SignatureAggregationResult {
    signedMessage: string;
}

const sdk = new Avalanche({
    chainId: SUBNET_ID,
    serverURL: SIGGNATURE_AGGREGATOR_URL,
})

export const aggregateSignature = async ({
    message,
    justification = '',
    signingSubnetId = SUBNET_ID,
    quorumPercentage = QUORUM_PERCENTAGE,
}: SignatureAggregationParams
): Promise<SignatureAggregationResult> => {

    const signatureAggregationRequest: any = {
        message,
        justification,
        'signing-subnet-id': signingSubnetId,
        'quorum-percentage': quorumPercentage
    };

    const response = await fetch(`${SIGGNATURE_AGGREGATOR_URL}/aggregate-signatures`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(signatureAggregationRequest)
    });

    if (!response.ok) {
        throw new Error(`Failed to aggregate signature: ${response.statusText}`);
    }

    const data = await response.json() as SignatureAggregationResponse;

    return {
        signedMessage: data['signed-message']
    };
}
