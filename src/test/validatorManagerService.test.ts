import { ValidatorManagerService } from "../ValidatorManagerService";
import { NODEJS_RPC_URL } from "../constants";

jest.setTimeout(60000);

describe("Validator Manager Service Test", () => {
    let validatorManagerService: ValidatorManagerService;
    beforeAll(() => {
        validatorManagerService = new ValidatorManagerService()
    })

    test("step_(-2) getPChainHeight", async () => {
        const height = await validatorManagerService.getPChainHeight();
        console.log(height);
    })
    test("step_(-1) get curent validators", async () => {
        const validators = await validatorManagerService.getCurentValidatorListFromSubnet("11111111111111111111111111111111LpoYY");
        console.log(validators);
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

    test("step_0.5 sendDummyPChainTx:", async () => {
        await validatorManagerService.sendDummyPChainTx();
    });

    test("step_1 initiateValidatorRegistration:", async () => {
        const txHash = await validatorManagerService.initiateValidatorRegistration(
            "NodeID-MFrZFVCXPv5iCn6M9K6XduxGTYp891xXZ",
            "0x8b49c4259529a801cc961c72248773b550379ff718a49f4ccc0e1f2ac338fe204432329aa1712f408f97eee12b22dd05",
            20n,
            "0x8db97C7cEcE249c2b98bDC0226Cc4C2A57BF52FC",
            "0x8db97C7cEcE249c2b98bDC0226Cc4C2A57BF52FC"
        );
        console.log(txHash);
    });
    test("step_2 submitPChainTxRegisterValidator:", async () => {
        const pChainHash = await validatorManagerService.submitPChainTxRegisterValidator(
            "0x17107204db047d5df056a40c6a7e42c2e9e3d32e349f70e53a41ffe92b49216b",
            10000000000n,
            "0xaf92674c3615d462527675da121b06023b116ddebc6e163919e562ab7cbe6adf20515cd2fc17c3e2d2d59953f285229e15f04302187bef5a4aa3ebdea1d18bf34047be654dd12491e882fb90b17b3cbde99ad43fc5cd0c26828bbe49a4b9456c",
        );
        console.log(pChainHash);
    });
    test("step_3 completeValidatorRegistration:", async () => {
        const txHash = await validatorManagerService.completeValidatorRegistration(
            "2bfrKjUG2RZ9XuHyiau1FsMJ6NzZSwNRU9RWajcRdBowBuostx",
        );
        console.log(txHash);
    });

    test("step_all_in_one", async () => {
        await validatorManagerService.registerValidator(
            "NodeID-MFrZFVCXPv5iCn6M9K6XduxGTYp891xXZ",
            "0x8b49c4259529a801cc961c72248773b550379ff718a49f4ccc0e1f2ac338fe204432329aa1712f408f97eee12b22dd05",
            "0xaf92674c3615d462527675da121b06023b116ddebc6e163919e562ab7cbe6adf20515cd2fc17c3e2d2d59953f285229e15f04302187bef5a4aa3ebdea1d18bf34047be654dd12491e882fb90b17b3cbde99ad43fc5cd0c26828bbe49a4b9456c",
            20n,
            "0x8db97C7cEcE249c2b98bDC0226Cc4C2A57BF52FC",
            "0x8db97C7cEcE249c2b98bDC0226Cc4C2A57BF52FC"
        )
    });
});