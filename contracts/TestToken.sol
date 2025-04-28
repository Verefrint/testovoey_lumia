// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title TestToken
 * @dev A simple ERC20 token for testing purposes with minting capability.
 */
contract TestToken is ERC20 {
    uint8 private immutable _customDecimals;

    /**
     * @dev Constructor that gives the token a name, symbol, and decimals.
     * @param name_ The name of the token.
     * @param symbol_ The symbol of the token.
     * @param decimals_ The number of decimals for the token.
     */
    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        _customDecimals = decimals_;
    }

    /**
     * @notice Returns the number of decimals used for display purposes.
     */
    function decimals() public view override returns (uint8) {
        return _customDecimals;
    }

    /**
     * @notice Mints `amount` of tokens to address `to`.
     * @dev Only for testing purposes. Anyone can mint.
     * @param to The address receiving the newly minted tokens.
     * @param amount The amount of tokens to mint.
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
