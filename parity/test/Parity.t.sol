// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SplitChaiSettlement} from "../src/SplitChaiSettlement.sol";
import {FeDeployer} from "./FeDeployer.sol";

/// @dev Minimal 6-decimal USDC stand-in.
contract MockUSDC {
    string public constant name = "USD Coin";
    string public constant symbol = "USDC";
    uint8 public constant decimals = 6;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amt) external {
        balanceOf[to] += amt;
    }

    function approve(address s, uint256 amt) external returns (bool) {
        allowance[msg.sender][s] = amt;
        return true;
    }

    function transferFrom(address f, address t, uint256 amt) external returns (bool) {
        uint256 a = allowance[f][msg.sender];
        require(a >= amt, "allowance");
        require(balanceOf[f] >= amt, "balance");
        if (a != type(uint256).max) allowance[f][msg.sender] = a - amt;
        balanceOf[f] -= amt;
        balanceOf[t] += amt;
        return true;
    }
}

/// @dev Token that returns false instead of reverting.
contract FalseToken {
    function transferFrom(address, address, uint256) external pure returns (bool) {
        return false;
    }
}

/// @dev The original SplitChai test suite, unchanged except that contracts are
///      created through `_deploy`, so the same 18 tests run against both the
///      Solidity and the Fe implementation.
abstract contract SplitChaiSettlementSuite is Test {
    function _deploy(address usdc_, address treasury_, uint16 feeBps_, address owner_)
        internal
        virtual
        returns (SplitChaiSettlement);

    SplitChaiSettlement s;
    MockUSDC usdc;

    address owner = makeAddr("owner");
    address treasury = makeAddr("treasury");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");

    bytes32 constant GROUP = keccak256("goa-trip");
    bytes32 constant MEMO = keccak256("settlement-1");

    event Settled(
        bytes32 indexed groupId, address indexed from, address indexed to, uint256 amount, uint256 fee, bytes32 memo
    );

    function setUp() public {
        usdc = new MockUSDC();
        s = _deploy(address(usdc), treasury, 30, owner); // 0.30%
        usdc.mint(alice, 1_000e6);
        vm.prank(alice);
        usdc.approve(address(s), type(uint256).max);
    }

    function test_constructorState() public view {
        assertEq(address(s.usdc()), address(usdc));
        assertEq(s.treasury(), treasury);
        assertEq(s.feeBps(), 30);
        assertEq(s.owner(), owner);
    }

    function test_constructorRejectsBadArgs() public {
        vm.expectRevert(SplitChaiSettlement.ZeroAddress.selector);
        _deploy(address(0), treasury, 30, owner);
        vm.expectRevert(SplitChaiSettlement.FeeTooHigh.selector);
        _deploy(address(usdc), treasury, 101, owner);
    }

    function test_settleWithFee() public {
        vm.expectEmit(true, true, true, true);
        emit Settled(GROUP, alice, bob, 100e6, 300_000, MEMO);
        vm.prank(alice);
        uint256 fee = s.settle(GROUP, bob, 100e6, MEMO);

        assertEq(fee, 300_000); // 0.30 USDC
        assertEq(usdc.balanceOf(bob), 99_700_000);
        assertEq(usdc.balanceOf(treasury), 300_000);
        assertEq(usdc.balanceOf(alice), 900e6);
        assertEq(usdc.balanceOf(address(s)), 0); // never custodial
    }

    function test_settleZeroFee() public {
        vm.prank(owner);
        s.setFeeBps(0);
        vm.prank(alice);
        s.settle(GROUP, bob, 25e6, MEMO);
        assertEq(usdc.balanceOf(bob), 25e6);
        assertEq(usdc.balanceOf(treasury), 0);
    }

    function test_tinyAmountRoundsFeeDown() public {
        vm.prank(alice);
        uint256 fee = s.settle(GROUP, bob, 100, MEMO); // 0.0001 USDC
        assertEq(fee, 0);
        assertEq(usdc.balanceOf(bob), 100);
    }

    function test_settleBatch() public {
        SplitChaiSettlement.Payment[] memory p = new SplitChaiSettlement.Payment[](2);
        p[0] = SplitChaiSettlement.Payment(bob, 40e6);
        p[1] = SplitChaiSettlement.Payment(carol, 60e6);
        vm.prank(alice);
        uint256 total = s.settleBatch(GROUP, p, MEMO);
        assertEq(total, 120_000 + 180_000);
        assertEq(usdc.balanceOf(bob), 40e6 - 120_000);
        assertEq(usdc.balanceOf(carol), 60e6 - 180_000);
        assertEq(usdc.balanceOf(treasury), 300_000);
    }

    function test_revertEmptyBatch() public {
        SplitChaiSettlement.Payment[] memory p;
        vm.prank(alice);
        vm.expectRevert(SplitChaiSettlement.EmptyBatch.selector);
        s.settleBatch(GROUP, p, MEMO);
    }

    function test_revertZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(SplitChaiSettlement.ZeroAmount.selector);
        s.settle(GROUP, bob, 0, MEMO);
    }

    function test_revertSelfPayment() public {
        vm.prank(alice);
        vm.expectRevert(SplitChaiSettlement.SelfPayment.selector);
        s.settle(GROUP, alice, 1e6, MEMO);
    }

    function test_revertZeroRecipient() public {
        vm.prank(alice);
        vm.expectRevert(SplitChaiSettlement.ZeroAddress.selector);
        s.settle(GROUP, address(0), 1e6, MEMO);
    }

    function test_revertWithoutAllowance() public {
        usdc.mint(carol, 10e6);
        vm.prank(carol);
        vm.expectRevert(SplitChaiSettlement.TransferFailed.selector);
        s.settle(GROUP, bob, 1e6, MEMO);
    }

    function test_revertOnFalseReturningToken() public {
        FalseToken t = new FalseToken();
        SplitChaiSettlement s2 = _deploy(address(t), treasury, 0, owner);
        vm.prank(alice);
        vm.expectRevert(SplitChaiSettlement.TransferFailed.selector);
        s2.settle(GROUP, bob, 1e6, MEMO);
    }

    function test_pause() public {
        vm.prank(owner);
        s.setPaused(true);
        vm.prank(alice);
        vm.expectRevert(SplitChaiSettlement.IsPaused.selector);
        s.settle(GROUP, bob, 1e6, MEMO);
    }

    function test_onlyOwnerAdmin() public {
        vm.startPrank(alice);
        vm.expectRevert(SplitChaiSettlement.NotOwner.selector);
        s.setFeeBps(10);
        vm.expectRevert(SplitChaiSettlement.NotOwner.selector);
        s.setTreasury(alice);
        vm.expectRevert(SplitChaiSettlement.NotOwner.selector);
        s.setPaused(true);
        vm.stopPrank();
    }

    function test_feeCap() public {
        vm.prank(owner);
        vm.expectRevert(SplitChaiSettlement.FeeTooHigh.selector);
        s.setFeeBps(101);
    }

    function test_setTreasury() public {
        vm.prank(owner);
        s.setTreasury(carol);
        vm.prank(alice);
        s.settle(GROUP, bob, 100e6, MEMO);
        assertEq(usdc.balanceOf(carol), 300_000);
    }

    function test_twoStepOwnership() public {
        vm.prank(owner);
        s.transferOwnership(bob);
        assertEq(s.owner(), owner);
        vm.prank(carol);
        vm.expectRevert(SplitChaiSettlement.NotPendingOwner.selector);
        s.acceptOwnership();
        vm.prank(bob);
        s.acceptOwnership();
        assertEq(s.owner(), bob);
        assertEq(s.pendingOwner(), address(0));
    }

    function testFuzz_settleConservesValue(uint96 amount, uint16 bps) public {
        bps = uint16(bound(bps, 0, 100));
        uint256 amt = bound(uint256(amount), 1, 1_000e6);
        vm.prank(owner);
        s.setFeeBps(bps);
        vm.prank(alice);
        uint256 fee = s.settle(GROUP, bob, amt, MEMO);
        assertEq(usdc.balanceOf(bob) + usdc.balanceOf(treasury), amt);
        assertEq(fee, (amt * bps) / 10_000);
        assertLe(fee, amt / 100);
        assertEq(usdc.balanceOf(address(s)), 0);
    }
}

/// @dev Reference: the Solidity contract deployed on Base.
contract SolidityParityTest is SplitChaiSettlementSuite {
    function _deploy(address usdc_, address treasury_, uint16 feeBps_, address owner_)
        internal
        override
        returns (SplitChaiSettlement)
    {
        return new SplitChaiSettlement(usdc_, treasury_, feeBps_, owner_);
    }
}

/// @dev The Fe port, deployed from `fe build` output (../out).
contract FeParityTest is SplitChaiSettlementSuite {
    function _deploy(address usdc_, address treasury_, uint16 feeBps_, address owner_)
        internal
        override
        returns (SplitChaiSettlement)
    {
        return SplitChaiSettlement(FeDeployer.deploy(vm, usdc_, treasury_, feeBps_, owner_));
    }
}
