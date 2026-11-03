// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {SplitChaiSettlement} from "../src/SplitChaiSettlement.sol";
import {MockUSDC} from "./Parity.t.sol";
import {FeDeployer} from "./FeDeployer.sol";

/// @dev Gas comparison: Solidity (solc 0.8.28, optimizer 10k runs) vs Fe
///      (Sonatina backend). Every measurement runs on a fresh deployment with
///      the contract, token and accounts cooled (`vm.cool`), so each call pays
///      cold-access costs the way a real transaction does. Numbers are the
///      execution gas of the external call (no 21k intrinsic, no calldata).
///      Run: forge test --match-contract GasBench -vv
contract GasBench is Test {
    address owner = makeAddr("owner");
    address treasury = makeAddr("treasury");
    address alice = makeAddr("alice");
    bytes32 constant GROUP = keccak256("goa-trip");
    bytes32 constant MEMO = keccak256("settlement-1");

    string[] names;
    uint256[] solGas;
    uint256[] feGas;

    function _deploy(bool fe, address usdc, uint16 fee) internal returns (SplitChaiSettlement) {
        if (fe) return SplitChaiSettlement(FeDeployer.deploy(vm, usdc, treasury, fee, owner));
        return new SplitChaiSettlement(usdc, treasury, fee, owner);
    }

    function _fresh(bool fe, uint16 fee) internal returns (SplitChaiSettlement s, MockUSDC usdc) {
        usdc = new MockUSDC();
        s = _deploy(fe, address(usdc), fee);
        usdc.mint(alice, 1_000_000e6);
        vm.prank(alice);
        usdc.approve(address(s), type(uint256).max);
        // Pre-fund recipients so the token's balance writes cost the same in
        // every run (nonzero -> nonzero), then cool everything.
        for (uint256 i; i < 10; ++i) {
            usdc.mint(_member(i), 1);
        }
        usdc.mint(treasury, 1);
        vm.cool(address(s));
        vm.cool(address(usdc));
    }

    function _member(uint256 i) internal pure returns (address) {
        return address(uint160(0xB0B0 + i));
    }

    function _batch(uint256 n) internal pure returns (SplitChaiSettlement.Payment[] memory p) {
        p = new SplitChaiSettlement.Payment[](n);
        for (uint256 i; i < n; ++i) {
            p[i] = SplitChaiSettlement.Payment(_member(i), 10e6 + i);
        }
    }

    function _settle(bool fe, uint16 fee) internal returns (uint256 g) {
        (SplitChaiSettlement s,) = _fresh(fe, fee);
        vm.prank(alice);
        g = gasleft();
        s.settle(GROUP, _member(0), 100e6, MEMO);
        g -= gasleft();
    }

    function _settleBatch(bool fe, uint256 n) internal returns (uint256 g) {
        (SplitChaiSettlement s,) = _fresh(fe, 30);
        SplitChaiSettlement.Payment[] memory p = _batch(n);
        vm.prank(alice);
        g = gasleft();
        s.settleBatch(GROUP, p, MEMO);
        g -= gasleft();
    }

    function _quote(bool fe) internal returns (uint256 g) {
        (SplitChaiSettlement s,) = _fresh(fe, 30);
        g = gasleft();
        s.quoteFee(100e6);
        g -= gasleft();
    }

    function _setFee(bool fe) internal returns (uint256 g) {
        (SplitChaiSettlement s,) = _fresh(fe, 30);
        vm.prank(owner);
        g = gasleft();
        s.setFeeBps(10);
        g -= gasleft();
    }

    function _revertZero(bool fe) internal returns (uint256 g) {
        (SplitChaiSettlement s,) = _fresh(fe, 30);
        vm.prank(alice);
        g = gasleft();
        try s.settle(GROUP, _member(0), 0, MEMO) {} catch {}
        g -= gasleft();
    }

    function _deployGas(bool fe) internal returns (uint256 g) {
        MockUSDC usdc = new MockUSDC();
        g = gasleft();
        _deploy(fe, address(usdc), 30);
        g -= gasleft();
    }

    function _row(string memory name, uint256 sol, uint256 fe) internal {
        names.push(name);
        solGas.push(sol);
        feGas.push(fe);
    }

    function test_gasReport() public {
        _row("settle (0.30% fee)", _settle(false, 30), _settle(true, 30));
        _row("settle (no fee)", _settle(false, 0), _settle(true, 0));
        _row("settleBatch x1", _settleBatch(false, 1), _settleBatch(true, 1));
        _row("settleBatch x3", _settleBatch(false, 3), _settleBatch(true, 3));
        _row("settleBatch x10", _settleBatch(false, 10), _settleBatch(true, 10));
        _row("quoteFee", _quote(false), _quote(true));
        _row("setFeeBps", _setFee(false), _setFee(true));
        _row("settle revert (ZeroAmount)", _revertZero(false), _revertZero(true));
        _row("deploy (incl. init code read)", _deployGas(false), _deployGas(true));

        console.log("| Call | Solidity | Fe | Fe vs Solidity |");
        console.log("|---|---:|---:|---:|");
        for (uint256 i; i < names.length; ++i) {
            int256 d = int256(feGas[i]) - int256(solGas[i]);
            int256 bp = (d * 10_000) / int256(solGas[i]);
            console.log(
                string.concat(
                    "| ",
                    names[i],
                    " | ",
                    vm.toString(solGas[i]),
                    " | ",
                    vm.toString(feGas[i]),
                    " | ",
                    d >= 0 ? "+" : "-",
                    vm.toString(_abs(bp) / 100),
                    ".",
                    _two(_abs(bp) % 100),
                    "% |"
                )
            );
        }
        SplitChaiSettlement solRef = new SplitChaiSettlement(address(1), treasury, 30, owner);
        console.log(
            string.concat(
                "| runtime bytecode (bytes) | ",
                vm.toString(address(solRef).code.length),
                " | ",
                vm.toString(FeDeployer.deploy(vm, address(1), treasury, 30, owner).code.length),
                " | |"
            )
        );
    }

    function _abs(int256 x) internal pure returns (uint256) {
        return uint256(x >= 0 ? x : -x);
    }

    function _two(uint256 x) internal pure returns (string memory) {
        return x < 10 ? string.concat("0", vm.toString(x)) : vm.toString(x);
    }
}
