// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

error EmptyDestibutionArray();
error TooLongArray();
error NotAllowedStartCampaignInPast();
error EmptyAddress();
error AirdropVestingPeriodEnded();
error AirdropVestingPeriodNotEnded();
error AlreadyClaimed();
error TooManyForWitdraw(uint availableAmount);

contract Airdrop is Ownable {
    using SafeERC20 for IERC20;

    //one token airdrop during one campaign can add during vesting time
    struct Campaign {
        uint vestingStart;
        uint vestingEnd; 
        address token;
        uint totalAllocated;
        uint totalDistributed;
    }

    //for receiving 
    struct AirdropParticipant {
        address user;
        uint amount;
        uint campaignId;
    }

    //campaign id => user address => amount to airdrop
    mapping(uint => mapping(address => uint)) public campaignDistribution;

    mapping(uint => Campaign) public airdropHistory;

    uint private id;

    event StartAirdrop(uint indexed id, address token);

    event DestributionChanged(address indexed participant, uint amount);

    event NewAirdropParticipants(address indexed user, uint amount, uint campaignId);

    constructor(address _owner) Ownable(_owner) {} 

    function startCompaign(address _token, 
                           uint _vestingStart, 
                           uint _durationInDays, 
                           uint _totalAllocated
                           ) public onlyOwner {
        require(_token != address(0), EmptyAddress());
        require(_vestingStart >= block.timestamp, NotAllowedStartCampaignInPast());

        uint vestingEnd = _vestingStart + (86400 * _durationInDays);

        id = id + 1;

        airdropHistory[id] = Campaign({
            token: _token,
            vestingStart: _vestingStart,
            vestingEnd: vestingEnd,
            totalAllocated: _totalAllocated,
            totalDistributed: 0
        });

        emit StartAirdrop(id, _token);
    }

    //also we can make multiple destribution on single call function
    function uploadParticipants(AirdropParticipant[] calldata _tokenDestribution) external onlyOwner {
        uint length = _tokenDestribution.length;

        require(length > 0, EmptyDestibutionArray());
        
        for (uint i = 0; i < length; i++) {
            AirdropParticipant calldata current = _tokenDestribution[i];

            Campaign memory campaign = airdropHistory[current.campaignId];

            require(block.timestamp <= campaign.vestingEnd, AirdropVestingPeriodEnded());
            
            if (campaignDistribution[current.campaignId][current.user] > 0) {
                emit DestributionChanged(current.user, current.amount);
            }

            campaignDistribution[current.campaignId][current.user] = current.amount;

            emit NewAirdropParticipants(current.user, current.amount, current.campaignId);
        }
    }

    function claim(uint _airdropId, uint _amountToWitdraw) public {
        Campaign memory current = airdropHistory[_airdropId];

        require(block.timestamp >= current.vestingEnd, AirdropVestingPeriodNotEnded());

        uint claimerAmount = campaignDistribution[_airdropId][msg.sender];
        require(claimerAmount > 0, AlreadyClaimed());
        require(claimerAmount <= _amountToWitdraw, TooManyForWitdraw(claimerAmount));

        campaignDistribution[_airdropId][msg.sender] = claimerAmount - _amountToWitdraw;
        IERC20(current.token).safeTransfer(msg.sender, _amountToWitdraw);
    }
}