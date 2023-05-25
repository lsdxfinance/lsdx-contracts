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

contract esLSD is Ownable, ReentrancyGuard, ERC20('esLSD Token', 'esLSD') {
  using Address for address;
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  IERC20 public immutable lsdToken;

  uint256 public vestingPeriod = 90 days;
  uint256 public constant MIN_VESTING_PERIOD = 30 days;
  uint256 public constant MAX_VESTING_PERIOD = 120 days;

  mapping(address => VestingInfo) public userVestings; // User's vesting instances

  struct VestingInfo {
    uint256 remainingAmount;
    uint256 lastUpdateTime;
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
  function claimUnlocked() external nonReentrant {
    VestingInfo storage vestingInfo = userVestings[_msgSender()];

    uint256 unlockAmount = _claimableAmount(vestingInfo);
    require(unlockAmount > 0, "No unlocked tokens to withdraw");

    vestingInfo.remainingAmount = vestingInfo.remainingAmount.sub(unlockAmount);
    vestingInfo.lastUpdateTime = block.timestamp;
    vestingInfo.endTime = Math.max(block.timestamp, vestingInfo.endTime);

    lsdToken.safeTransfer(_msgSender(), unlockAmount);
    _burn(address(this), unlockAmount);
    emit ClaimUnlocked(_msgSender(), unlockAmount);
  }

  /**
   * @dev Vest $LSD tokens from $esLSD tokens
   * @param amount Amount of $esLSD to vest
   */ 
  function vest(uint256 amount) external nonReentrant {
    require(amount > 0, "Amount must be greater than 0");

    VestingInfo storage vestingInfo = userVestings[msg.sender];
    uint256 unlockAmount = _claimableAmount(vestingInfo);
    if (unlockAmount > 0) {
      lsdToken.safeTransfer(_msgSender(), unlockAmount);
      _burn(address(this), unlockAmount);
      emit ClaimUnlocked(_msgSender(), unlockAmount);
    }

    vestingInfo.remainingAmount = vestingInfo.remainingAmount.sub(unlockAmount).add(amount);
    vestingInfo.lastUpdateTime = block.timestamp;
    vestingInfo.endTime = block.timestamp.add(vestingPeriod);
    emit Vest(_msgSender(), amount, vestingInfo.remainingAmount, vestingPeriod);
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
    return _claimableAmount(vestingInfo);
  }

  /*******************************************************/
  /****************** RESTRICTED FUNCTIONS ***************/
  /*******************************************************/

  function setVestingPeriod(uint256 _period) external onlyOwner nonReentrant {
    require(_period >= MIN_VESTING_PERIOD && _period <= MAX_VESTING_PERIOD, "Invalid duration");
    require(_period != vestingPeriod, "Same period");

    uint256 previousVestPeriod = vestingPeriod;
    vestingPeriod = _period;
    emit UpdateVestingDuration(previousVestPeriod, vestingPeriod);
  }

  /********************************************************/
  /****************** INTERNAL FUNCTIONS ******************/
  /********************************************************/

  function _claimableAmount(VestingInfo memory vestingInfo) internal view returns (uint256) {
    if (vestingInfo.remainingAmount == 0) {
      return 0;
    }
    require(vestingInfo.lastUpdateTime <= block.timestamp, "Vesting is not started yet, should not happen");

    uint256 endTime = Math.min(vestingInfo.endTime, block.timestamp);
    uint256 _vestingPeriod = endTime.sub(vestingInfo.lastUpdateTime);
    if (_vestingPeriod == 0) {
      return vestingInfo.remainingAmount;
    }
    return vestingInfo.remainingAmount.mul(endTime.sub(vestingInfo.lastUpdateTime)).div(_vestingPeriod);
  }

  /********************************************/
  /****************** EVENTS ******************/
  /********************************************/

  event UpdateVestingDuration(uint256 previousDuration, uint256 duration);
  event Escrow(address indexed userAddress, uint256 amount);
  event ClaimUnlocked(address indexed userAddress, uint256 amount);
  event Vest(address indexed userAddress, uint256 amount, uint256 accruedAmount, uint256 duration);
}