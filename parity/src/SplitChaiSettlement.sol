// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Minimal {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title SplitChaiSettlement
/// @notice Moves USDC from a payer to a group member to settle a SplitChai balance,
///         optionally taking a small protocol fee for the treasury.
/// @dev Non-custodial: the contract never holds funds. It pulls from the payer
///      (who must approve this contract, or batch approve+settle via a smart wallet)
///      and pushes straight to the recipient and treasury in the same call.
///      Every settlement emits `Settled`, which is the source of truth for
///      usage numbers (users, volume) on the grant application.
contract SplitChaiSettlement {
    /// @notice Hard cap on the fee: 1% (100 basis points). The owner can never exceed it.
    uint16 public constant MAX_FEE_BPS = 100;

    IERC20Minimal public immutable usdc;
    address public owner;
    address public pendingOwner;
    address public treasury;
    uint16 public feeBps;
    bool public paused;

    uint256 private _locked = 1;

    struct Payment {
        address to;
        uint256 amount;
    }

    event Settled(
        bytes32 indexed groupId,
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 fee,
        bytes32 memo
    );
    event FeeUpdated(uint16 feeBps);
    event TreasuryUpdated(address treasury);
    event Paused(bool paused);
    event OwnershipTransferStarted(address indexed from, address indexed to);
    event OwnershipTransferred(address indexed from, address indexed to);

    error NotOwner();
    error NotPendingOwner();
    error ZeroAddress();
    error ZeroAmount();
    error SelfPayment();
    error FeeTooHigh();
    error IsPaused();
    error TransferFailed();
    error Reentrancy();
    error EmptyBatch();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier nonReentrant() {
        if (_locked != 1) revert Reentrancy();
        _locked = 2;
        _;
        _locked = 1;
    }

    modifier whenNotPaused() {
        if (paused) revert IsPaused();
        _;
    }

    constructor(address usdc_, address treasury_, uint16 feeBps_, address owner_) {
        if (usdc_ == address(0) || treasury_ == address(0) || owner_ == address(0)) revert ZeroAddress();
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh();
        usdc = IERC20Minimal(usdc_);
        treasury = treasury_;
        feeBps = feeBps_;
        owner = owner_;
        emit OwnershipTransferred(address(0), owner_);
        emit FeeUpdated(feeBps_);
        emit TreasuryUpdated(treasury_);
    }

    // ------------------------------------------------------------------
    // Settlement
    // ------------------------------------------------------------------

    /// @notice Settle `amount` (6-decimal USDC units) from msg.sender to `to`.
    /// @dev The payer sends exactly `amount`; the recipient receives `amount - fee`.
    /// @param groupId  Off-chain SplitChai group id (e.g. keccak256 of the group UUID).
    /// @param memo     Optional reference, e.g. keccak256 of the expense/settlement id.
    function settle(bytes32 groupId, address to, uint256 amount, bytes32 memo)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 fee)
    {
        fee = _settle(groupId, msg.sender, to, amount, memo);
    }

    /// @notice Settle several debts in one transaction (e.g. "settle all" in a group).
    function settleBatch(bytes32 groupId, Payment[] calldata payments, bytes32 memo)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 totalFee)
    {
        uint256 n = payments.length;
        if (n == 0) revert EmptyBatch();
        for (uint256 i; i < n; ++i) {
            totalFee += _settle(groupId, msg.sender, payments[i].to, payments[i].amount, memo);
        }
    }

    /// @notice Fee that would be charged on `amount` at the current rate.
    function quoteFee(uint256 amount) public view returns (uint256) {
        return (amount * feeBps) / 10_000;
    }

    function _settle(bytes32 groupId, address from, address to, uint256 amount, bytes32 memo)
        internal
        returns (uint256 fee)
    {
        if (to == address(0)) revert ZeroAddress();
        if (to == from) revert SelfPayment();
        if (amount == 0) revert ZeroAmount();

        fee = quoteFee(amount);
        _pull(from, to, amount - fee);
        if (fee > 0) _pull(from, treasury, fee);

        emit Settled(groupId, from, to, amount, fee, memo);
    }

    function _pull(address from, address to, uint256 amount) internal {
        (bool ok, bytes memory data) =
            address(usdc).call(abi.encodeCall(IERC20Minimal.transferFrom, (from, to, amount)));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }

    // ------------------------------------------------------------------
    // Admin
    // ------------------------------------------------------------------

    function setFeeBps(uint16 feeBps_) external onlyOwner {
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh();
        feeBps = feeBps_;
        emit FeeUpdated(feeBps_);
    }

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        emit TreasuryUpdated(treasury_);
    }

    function setPaused(bool paused_) external onlyOwner {
        paused = paused_;
        emit Paused(paused_);
    }

    /// @notice Two-step ownership transfer so ownership can't be sent to a typo.
    function transferOwnership(address newOwner) external onlyOwner {
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotPendingOwner();
        emit OwnershipTransferred(owner, msg.sender);
        owner = msg.sender;
        pendingOwner = address(0);
    }
}
