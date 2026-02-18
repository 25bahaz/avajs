import { ValidatorManagerService } from "../ValidatorManagerService";
import { NODEJS_RPC_URL, SUBNET_ID } from "../constants";
import bs58  from 'bs58';
jest.setTimeout(600000);

describe("Validator Manager Service Test", () => {
    let validatorManagerService: ValidatorManagerService;
    beforeAll(() => {
        validatorManagerService = new ValidatorManagerService()
    })

    test("step_(-5) cb58 valid to hex valid", () => {
        const decode = bs58.decode("24CDaC1Qd5iuP6B6omWRUHuCZzmpNcMqX6U5Ex7E5JkmnDcjxP")
        const raw32 = decode.slice(0,32);
        const hex = Buffer.from(raw32).toString('hex');
        console.log(hex);
        const decode1 = bs58.decode("2nespXar6qoeQVEUbB925AT2JVvyoQKyfm4NvTV9YLzZ5NBt45")
        const raw321 = decode1.slice(0,32);
        const hex1 = Buffer.from(raw321).toString('hex');
        console.log(hex1);
        const decode2 = bs58.decode("jbVejeab5dHjhakduNgg8vFh6iMrHJ9MsMDSzFLdedp7KQ2sL")
        const raw322 = decode2.slice(0,32);
        const hex2 = Buffer.from(raw322).toString('hex');
        console.log(hex2);
    })


    test("step_(-4) get validator from contract", async () => {
        const val1 = await validatorManagerService.validatorProxyContract.read.getValidator(["0x8af2741161845ad20c92484ea36cb6a019b3ef7c66563232020502416d1e73f8"])
        const val2 = await validatorManagerService.validatorProxyContract.read.getValidator(["0xeb5b5df9bd6e827ec50a3d26cc5e54ba3c7574cbef2f4ac8325e2d4cef10549c"])
        const val3 = await validatorManagerService.validatorProxyContract.read.getValidator(["0x60b76e92a7faba3614f2adb92d226beb4104e548675a7d0beb7e72768e946178"])
        console.log(val1)
        console.log(val2)
        console.log(val3)
    })

    test("step_(-3) l1TotalWeight from contract", async () => {
        const l1TotalWeight = await validatorManagerService.validatorProxyContract.read.l1TotalWeight()
        console.log(l1TotalWeight);
    })

    test("step_(-2) getPChainHeight", async () => {
        const height = await validatorManagerService.getPChainHeight();
        console.log(height);
    })
    test("step_(-1) get curent validators", async () => {
        const validators = await validatorManagerService.getCurentValidatorListFromSubnet(SUBNET_ID);
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

    test("getLatest block", async () => {
        console.log(await validatorManagerService.walletClient.getBlock());
    })

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
            "0x134bfad2468266b0701e2d32af83839bd2eea692c3d079a60ae31bf1d4794de0",
            10000000000n,
            "0xaf92674c3615d462527675da121b06023b116ddebc6e163919e562ab7cbe6adf20515cd2fc17c3e2d2d59953f285229e15f04302187bef5a4aa3ebdea1d18bf34047be654dd12491e882fb90b17b3cbde99ad43fc5cd0c26828bbe49a4b9456c",
        );
        console.log(pChainHash);
    });
    test("step_3 completeValidatorRegistration:", async () => {
        const txHash = await validatorManagerService.completeValidatorRegistration(
            "2oZrAfddiH7ZASDB25kvHuCfRWq5XgekkqWBVrbexRFdL46ArA",
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