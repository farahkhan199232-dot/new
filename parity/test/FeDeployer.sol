// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Vm} from "forge-std/Vm.sol";

/// @dev Deploys the Fe-compiled SplitChaiSettlement from `fe build` output.
///      Constructor arguments are ABI-encoded and appended to the init code,
///      exactly as for a Solidity contract.
library FeDeployer {
    string internal constant BIN = "../out/SplitChaiSettlement.bin";

    function initCode(Vm vm) internal view returns (bytes memory) {
        return vm.parseBytes(string.concat("0x", vm.trim(vm.readFile(BIN))));
    }

    function deploy(Vm vm, address usdc, address treasury, uint16 feeBps, address owner)
        internal
        returns (address addr)
    {
        bytes memory code = abi.encodePacked(initCode(vm), abi.encode(usdc, treasury, feeBps, owner));
        assembly {
            addr := create(0, add(code, 0x20), mload(code))
            if iszero(addr) {
                // Bubble the constructor's revert data (custom errors).
                returndatacopy(0, 0, returndatasize())
                revert(0, returndatasize())
            }
        }
    }
}
