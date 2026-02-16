import { ValidatorManagerService } from "../ValidatorManagerService";
import { NODEJS_RPC_URL } from "../constants";

jest.setTimeout(60000);

describe("Validator Manager Service Test", () => {
    let validatorManagerService: ValidatorManagerService;
    beforeAll(() => {
        validatorManagerService = new ValidatorManagerService()
    })

    test("step_0 getBlockNumber:", async () => {
        const body = {
            jsonrpc: "2.0",
            id: 1,
            method: "eth_blockNumber", // EVM compatible method
            params: []
        };

        const response = await fetch(NODEJS_RPC_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        const data = await response.json();
        console.log(data);
        return
    });

    test("step_1 initiateValidatorRegistration:", async () => {
        const txHash = await validatorManagerService.initiateValidatorRegistration(
            "NodeID-7Xhw2mDxuDS44j42TCB6U5579esbSt3Lg",
            "0xb3ebbe748a1f06d19ee25d4e345ba8d6b5a426498a140c2519b518e3e6224abd7895075892f361acf24c10af968bc7de",
            20n,
            "0x8db97C7cEcE249c2b98bDC0226Cc4C2A57BF52FC",
            "0x8db97C7cEcE249c2b98bDC0226Cc4C2A57BF52FC"
        );
        console.log(txHash);
    });
    test("step_2 submitPChainTxRegisterValidator:", async () => {
        const pChainHash = await validatorManagerService.submitPChainTxRegisterValidator(
            "0x134bfad2468266b0701e2d32af83839bd2eea692c3d079a60ae31bf1d4794de0",
            20n,
            "0xa2569a137e65d3a507c4f1f7ffac74ec05916ba44dfbbb84d42c2736a2bc1e8be14038d3aeeeac7c78e19ecdde69d830051959f22559641a3f9e42377d7f64580acdc383c5c9e22f7f1114712a543c6997d6dc59c88555423497d9fff41fa79a",
        );
        console.log(pChainHash);
    });
    test("step_3 completeValidatorRegistration:", async () => {
        const txHash = await validatorManagerService.completeValidatorRegistration(
            "2KyH1hVkKc94RASSuHPVNkE2gUimVeS3JM5u8THxBhT2nBhPog",
        );
        console.log(txHash);
    });

    test("step_all_in_one", async () => {
        await validatorManagerService.registerValidator(
            "NodeID-7Xhw2mDxuDS44j42TCB6U5579esbSt3Lg",
            "0xb3ebbe748a1f06d19ee25d4e345ba8d6b5a426498a140c2519b518e3e6224abd7895075892f361acf24c10af968bc7de",
            "0xa2569a137e65d3a507c4f1f7ffac74ec05916ba44dfbbb84d42c2736a2bc1e8be14038d3aeeeac7c78e19ecdde69d830051959f22559641a3f9e42377d7f64580acdc383c5c9e22f7f1114712a543c6997d6dc59c88555423497d9fff41fa79a",
            20n,
            "0x8db97C7cEcE249c2b98bDC0226Cc4C2A57BF52FC",
            "0x8db97C7cEcE249c2b98bDC0226Cc4C2A57BF52FC"
        )
    });
});