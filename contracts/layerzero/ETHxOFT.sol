// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.9;

import "@layerzerolabs/solidity-examples/contracts/token/oft/OFT.sol";

/// @title A LayerZero OmnichainFungibleToken example of BasedOFT
/// @notice Use this contract only on the BASE CHAIN. It locks tokens on source, on outgoing send(), and unlocks tokens when receiving from other chains.
/// @dev https://github.com/LayerZero-Labs/solidity-examples/blob/main/contracts/examples/ExampleOFT.sol
contract ETHxOFT is OFT {
  constructor(address _layerZeroEndpoint) OFT("ETHx Token", "ETHx", _layerZeroEndpoint) {}

  function mintTokens(address _to, uint256 _amount) external {
    _mint(_to, _amount);
  }
}