// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.9;

import "@layerzerolabs/solidity-examples/contracts/token/oft/OFTCore.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// Ref: https://github.com/LayerZero-Labs/solidity-examples/blob/main/contracts/token/oft/extension/ProxyOFT.sol
contract ETHxProxyOFT is OFTCore {
  using SafeERC20 for IERC20;

  IERC20 internal immutable innerToken;

  constructor(address _lzEndpoint, address _token) OFTCore(_lzEndpoint) {
    innerToken = IERC20(_token);
  }

  function circulatingSupply() public view virtual override returns (uint) {
    unchecked {
      return innerToken.totalSupply() - innerToken.balanceOf(address(this));
    }
  }

  function token() public view virtual override returns (address) {
    return address(innerToken);
  }

  function _debitFrom(address _from, uint16, bytes memory, uint _amount) internal virtual override returns(uint) {
    require(_from == _msgSender(), "ETHxProxyOFT: owner is not send caller");
    uint before = innerToken.balanceOf(address(this));
    innerToken.safeTransferFrom(_from, address(this), _amount);
    return innerToken.balanceOf(address(this)) - before;
  }

  function _creditTo(uint16, address _toAddress, uint _amount) internal virtual override returns(uint) {
    uint before = innerToken.balanceOf(_toAddress);
    innerToken.safeTransfer(_toAddress, _amount);
    return innerToken.balanceOf(_toAddress) - before;
  }
}