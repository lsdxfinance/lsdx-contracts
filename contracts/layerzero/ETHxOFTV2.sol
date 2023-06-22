// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.9;

import "@layerzerolabs/solidity-examples/contracts/token/oft/v2/OFTV2.sol";

/// @title A LayerZero OmnichainFungibleToken example of BasedOFT
/// @notice Use this contract only on the BASE CHAIN. It locks tokens on source, on outgoing send(), and unlocks tokens when receiving from other chains.
/// @dev https://github.com/LayerZero-Labs/solidity-examples/blob/main/contracts/examples/ExampleOFTV2.sol
contract ETHxOFTV2 is OFTV2 {
  constructor(address _layerZeroEndpoint, uint _initialSupply, uint8 _sharedDecimals) OFTV2("ETHx OFT", "ETHx", _sharedDecimals, _layerZeroEndpoint) {
    _mint(_msgSender(), _initialSupply);
  }
}