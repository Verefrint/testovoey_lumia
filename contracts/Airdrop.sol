// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

error EmptyDestibutionArray();
error TooLongArray();
error NotAllowedStartCampaignInPast();
error EmptyAddress();
error CampaignFinalized();
error CampaignNotAllowed();
error AlreadyClaimed();
error TooManyForWitdraw(uint availableAmount);
error InvalidDistributionSum();

contract Airdrop is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    //one token airdrop during one campaign can add during vesting time
    struct Campaign {
        uint vestingStart;
        uint vestingEnd;
        address token;
        uint totalAllocated;
        uint totalDistributed;
        bool finalized;
    }

    //for receiving
    struct AirdropParticipant {
        address user;
        uint amount;
        uint campaignId;
    }

    //campaign id => user address => amount to airdrop
    mapping(uint => mapping(address => uint)) public campaignDistribution;

    mapping(uint => Campaign) public campaigns;

    uint public id;

    uint constant SECONDS_IN_DAY = 86400;

    event StartAirdrop(uint indexed id, address token);

    event DestributionChanged(address indexed participant, uint amount);

    event NewAirdropParticipants(AirdropParticipant[] participants);

    constructor(address _owner) Ownable(_owner) {}

    function startCompaign(
        address _token,
        uint _totalAllocated
    ) public onlyOwner {
        require(_token != address(0), EmptyAddress());

        IERC20(_token).safeTransferFrom(msg.sender, address(this), _totalAllocated);

        campaigns[++id] = Campaign({
            token: _token,
            vestingStart: 0,
            vestingEnd: 0,
            totalAllocated: _totalAllocated,
            totalDistributed: 0,
            finalized: false
        });

        emit StartAirdrop(id, _token);
    }

    function uploadParticipants(AirdropParticipant[] calldata _tokenDestribution) public onlyOwner {
        uint length = _tokenDestribution.length;

        require(length > 0, EmptyDestibutionArray());

        unchecked {
            for (uint i = 0; i < length; i++) {
                AirdropParticipant calldata current = _tokenDestribution[i];

                Campaign storage curCamp = campaigns[current.campaignId];

                require(!curCamp.finalized, CampaignFinalized());

                if (campaignDistribution[current.campaignId][current.user] > 0) {
                    curCamp.totalDistributed -= campaignDistribution[current.campaignId][current.user];

                    emit DestributionChanged(current.user, current.amount);
                }

                require((curCamp.totalDistributed + current.amount) <= curCamp.totalAllocated, InvalidDistributionSum());

                campaignDistribution[current.campaignId][current.user] = current.amount;
                curCamp.totalDistributed += current.amount;
            }
        }

        emit NewAirdropParticipants(_tokenDestribution);
    }

    function finalizeCampaign(
        uint256 _campaignId,
        uint _vestingStart,
        uint _durationInDays
    ) external onlyOwner {
        Campaign storage campaign = campaigns[_campaignId];
        require(!campaign.finalized, CampaignFinalized());

        require(_vestingStart >= block.timestamp, NotAllowedStartCampaignInPast());

        uint vestingEnd = _vestingStart + (SECONDS_IN_DAY * _durationInDays);

        campaign.finalized = true;
        campaign.vestingStart = _vestingStart;
        campaign.vestingEnd = vestingEnd;
    }

    function claim(uint _airdropId, uint _amountToWithdraw) public nonReentrant {
        Campaign storage current = campaigns[_airdropId];

        require(
            block.timestamp >= current.vestingStart && current.finalized,
            CampaignNotAllowed()
        );

        uint initialAllocation = campaignDistribution[_airdropId][msg.sender];
        require(initialAllocation > 0, AlreadyClaimed());

        uint vestedAmount;
        if (block.timestamp >= current.vestingEnd) {
            vestedAmount = initialAllocation;
        } else {
            vestedAmount = (initialAllocation * (block.timestamp - current.vestingStart)) 
                            / (current.vestingEnd - current.vestingStart);
        }

        require(vestedAmount >= _amountToWithdraw, TooManyForWitdraw(vestedAmount));

        campaignDistribution[_airdropId][msg.sender] = initialAllocation - _amountToWithdraw;
        IERC20(current.token).safeTransfer(msg.sender, _amountToWithdraw);
    }

}