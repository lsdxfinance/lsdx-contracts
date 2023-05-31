// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.9;

// import "hardhat/console.sol";

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";


contract esLSD is Ownable, ReentrancyGuard, ERC20("esLSD Token", "esLSD") {
  using Address for address;
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  IERC20 public immutable lsdToken;
  address public zapDelegator;

  uint256 public vestingPeriod = 90 days;
  uint256 public constant MIN_VESTING_PERIOD = 30 days;
  uint256 public constant MAX_VESTING_PERIOD = 120 days;

  mapping(address => VestingInfo) public userVestings; // User's vesting instances

  struct VestingInfo {
    uint256 amount;
    uint256 startTime;
    uint256 endTime;
  }

  constructor(address _lsdToken) {
    require(_lsdToken != address(0), "Zero address detected");
    lsdToken = IERC20(_lsdToken);
  }

  /*******************************************************/
  /****************** MUTATIVE FUNCTIONS *****************/
  /*******************************************************/

  /**
   * @dev Escrow $LSD tokens to get $esLSD tokens
   * @param amount Amount of $LSD to escrow
   */
  function escrow(uint256 amount) external nonReentrant {
    require(amount > 0, "Amount must be greater than 0");

    lsdToken.safeTransferFrom(_msgSender(), address(this), amount);
    _mint(_msgSender(), amount);

    emit Escrow(_msgSender(), amount);
  }

  /**
   * @dev Withdraw unlocked $LSD tokens if there are ongoing redeems
   */
  function claim() external nonReentrant {
    VestingInfo storage vestingInfo = userVestings[_msgSender()];
    require(vestingInfo.amount > 0, "No tokens to claim");
    require(block.timestamp >= vestingInfo.startTime, "Vesting not started");

    uint256 unlocked = 0;
    if (block.timestamp >= vestingInfo.endTime) {
      unlocked = vestingInfo.amount;
      delete userVestings[_msgSender()];
    }
    else {
      unlocked = vestingInfo.amount.mul(block.timestamp.sub(vestingInfo.startTime)).div(vestingInfo.endTime.sub(vestingInfo.startTime));
      vestingInfo.amount = vestingInfo.amount.sub(unlocked);
      vestingInfo.startTime = block.timestamp;
    }

    if (unlocked > 0) {
      lsdToken.safeTransfer(_msgSender(), unlocked);
      _burn(address(this), unlocked);
      emit Claim(_msgSender(), unlocked);
    }
  }

  /**
   * @dev Vest $LSD tokens from $esLSD tokens
   * @param amount Amount of $esLSD to vest
   */ 
  function vest(uint256 amount) external nonReentrant {
    require(amount > 0, "Amount must be greater than 0");
    require(amount <= balanceOf(_msgSender()), "Vest amount exceeds balance");

    _transfer(_msgSender(), address(this), amount);

    VestingInfo storage vestingInfo = userVestings[msg.sender];
    uint256 accruedAmount = amount;
    uint256 unlocked = 0;
    // Case 1: No ongoing vesting
    if (vestingInfo.amount == 0) {

    }
    // Case 2: Ongoing vesting
    else {
      require(block.timestamp >= vestingInfo.startTime, "Vesting not started");
      // Case 2.1: Ongoing vesting, all vested
      if (block.timestamp >= vestingInfo.endTime) {
        unlocked = vestingInfo.amount;
      }
      // Case 2.2: Ongoing vesting, partial vested
      else {
        unlocked = vestingInfo.amount.mul(block.timestamp.sub(vestingInfo.startTime)).div(vestingInfo.endTime.sub(vestingInfo.startTime));
        accruedAmount = accruedAmount.add(vestingInfo.amount).sub(unlocked);
      }
    }

    if (unlocked > 0) {
      lsdToken.safeTransfer(_msgSender(), unlocked);
      _burn(address(this), unlocked);
      emit Claim(_msgSender(), unlocked);
    }

    vestingInfo.amount = accruedAmount;
    vestingInfo.startTime = block.timestamp;
    vestingInfo.endTime = block.timestamp.add(vestingPeriod);
    emit Vest(_msgSender(), amount, vestingInfo.amount, vestingPeriod);
  }

  /**
   * @dev Allow zap delegator to flash vest $esLSD tokens
   * @param to  Account to flash vest $LSD tokens to
   */
  function zapVest(uint256 amount, address to) external nonReentrant onlyZapDelegator(_msgSender()) {
    require(amount > 0, "Amount must be greater than 0");
    require(to != address(0), "Zero address detected");

    _transfer(_msgSender(), address(this), amount);
    _burn(address(this), amount);
    lsdToken.safeTransfer(to, amount);

    emit ZapVest(_msgSender(), to, amount);
  }


  /**************************************************/
  /****************** PUBLIC VIEWS ******************/
  /**************************************************/

  /**
   * @dev Query the amount of $LSD tokens that can be redeemed
   * @param account Account to query
   */
  function claimableAmount(address account) public view returns (uint256) {
    require(account != address(0), "Zero address detected");

    VestingInfo memory vestingInfo = userVestings[account];
    if (vestingInfo.amount == 0) {
      return 0;
    }

    require(block.timestamp >= vestingInfo.startTime, "Vesting not started");
    if (block.timestamp >= vestingInfo.endTime) {
      return vestingInfo.amount;
    }
    else {
      return vestingInfo.amount.mul(block.timestamp.sub(vestingInfo.startTime)).div(vestingInfo.endTime.sub(vestingInfo.startTime));
    }
  }

  /*******************************************************/
  /****************** RESTRICTED FUNCTIONS ***************/
  /*******************************************************/

  function setVestingPeriod(uint256 _period) external onlyOwner nonReentrant {
    require(_period >= MIN_VESTING_PERIOD && _period <= MAX_VESTING_PERIOD, "Invalid period");
    require(_period != vestingPeriod, "Same period");

    uint256 previousVestPeriod = vestingPeriod;
    vestingPeriod = _period;
    emit UpdateVestingPeriod(previousVestPeriod, vestingPeriod);
  }

  function setZapDelegator(address _zapDelegator) external nonReentrant onlyOwner {
    require(_zapDelegator != address(0), "Zero address detected");
    require(zapDelegator != _zapDelegator, "Same zap delegator");

    address previousDelegator = zapDelegator;
    zapDelegator = _zapDelegator;
    emit UpdateZapDelegator(previousDelegator, zapDelegator);
  }

  /***********************************************/
  /****************** MODIFIERS ******************/
  /***********************************************/

  modifier onlyZapDelegator(address _address) {
    require(zapDelegator == _address, "Not zap delegator");
    _;
  }

  /********************************************/
  /****************** EVENTS ******************/
  /********************************************/

  event UpdateVestingPeriod(uint256 previousDuration, uint256 period);
  event UpdateZapDelegator(address previousDelegator, address delegator);
  event Escrow(address indexed userAddress, uint256 amount);
  event Claim(address indexed userAddress, uint256 amount);
  event Vest(address indexed userAddress, uint256 amount, uint256 accruedAmount, uint256 period);
  event ZapVest(address indexed fromAddress, address toAddress, uint256 amount);
}