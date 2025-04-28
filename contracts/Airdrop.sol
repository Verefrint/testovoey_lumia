// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

error EmptyDistributionArray();
error TooLongArray();
error NotAllowedStartCampaignInPast();
error EmptyAddress();
error CampaignFinalized();
error CampaignNotAllowed();
error AlreadyClaimed();
error TooManyForWitdraw(uint availableAmount);
error InvalidDistributionSum();
error DurationMustBeNotNull();

/**
 * @title Airdrop
 * @notice This contract manages multiple airdrop campaigns with linear vesting schedules.
 * @dev Only the contract owner can create, upload, and finalize campaigns. Users can claim their vested tokens based on their allocations.
 */
contract Airdrop is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Represents an airdrop campaign configuration.
    struct Campaign {
        uint vestingStart;       // Timestamp when vesting begins
        uint vestingEnd;         // Timestamp when vesting ends
        address token;           // ERC20 token address for distribution
        uint totalAllocated;     // Total tokens allocated for the campaign
        uint totalDistributed;   // Total tokens distributed among participants
        bool finalized;          // Whether the campaign is finalized
    }

    /// @notice Structure for participant allocations used during batch uploads.
    struct AirdropParticipant {
        address user;            // Address of the participant
        uint amount;             // Amount of tokens allocated
        uint campaignId;         // ID of the campaign this allocation belongs to
    }

    /// @notice Mapping: campaign ID => user address => remaining claimable amount.
    mapping(uint => mapping(address => uint)) public campaignDistribution;

    /// @notice Mapping: campaign ID => Campaign metadata.
    mapping(uint => Campaign) public campaigns;

    /// @notice Counter for campaign IDs.
    uint public id;

    /// @notice Constant representing number of seconds in one day.
    uint constant SECONDS_IN_DAY = 86400;

    /// @notice Emitted when a new airdrop campaign is started.
    event StartAirdrop(uint indexed id, address token);

    /// @notice Emitted when a participant's distribution is updated.
    event DestributionChanged(address indexed participant, uint amount);

    /// @notice Emitted after a batch of participants is uploaded.
    event NewAirdropParticipants(AirdropParticipant[] participants);

    /**
     * @notice Constructor to set the initial contract owner.
     * @param _owner Address of the owner.
     */
    constructor(address _owner) Ownable(_owner) {}

    /**
     * @notice Starts a new airdrop campaign by transferring tokens to the contract.
     * @dev Only callable by the contract owner.
     * @param _token The ERC20 token address to be distributed.
     * @param _totalAllocated Total amount of tokens to allocate for the campaign.
     */
    function startCampaign(
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

    /**
     * @notice Uploads a batch of airdrop participants and their allocations.
     * @dev Only callable by the contract owner. Cannot upload if campaign is finalized.
     * @param _tokenDestribution Array of AirdropParticipant structs.
     * @param _preDefinedLength Predefined maximum allowed length to protect from large uploads.
     */
    function uploadParticipants(
        AirdropParticipant[] calldata _tokenDestribution,
        uint _preDefinedLength
    ) public onlyOwner {
        uint length = _tokenDestribution.length;

        require(length > 0, EmptyDistributionArray());
        require(length <= _preDefinedLength, TooLongArray());

        unchecked {
            for (uint i = 0; i < length; i++) {
                AirdropParticipant calldata current = _tokenDestribution[i];
                Campaign storage curCamp = campaigns[current.campaignId];

                require(!curCamp.finalized, CampaignFinalized());

                if (campaignDistribution[current.campaignId][current.user] > 0) {
                    curCamp.totalDistributed -= campaignDistribution[current.campaignId][current.user];
                    emit DestributionChanged(current.user, current.amount);
                }

                require(
                    (curCamp.totalDistributed + current.amount) <= curCamp.totalAllocated,
                    InvalidDistributionSum()
                );

                campaignDistribution[current.campaignId][current.user] = current.amount;
                curCamp.totalDistributed += current.amount;
            }
        }

        emit NewAirdropParticipants(_tokenDestribution);
    }

    /**
     * @notice Finalizes a campaign by setting vesting parameters.
     * @dev Only callable by the contract owner. Vesting must start now or later.
     * @param _campaignId The ID of the campaign to finalize.
     * @param _vestingStart Timestamp when vesting starts.
     * @param _durationInDays Duration of vesting period in days.
     */
    function finalizeCampaign(
        uint256 _campaignId,
        uint _vestingStart,
        uint _durationInDays
    ) external onlyOwner {
        Campaign storage campaign = campaigns[_campaignId];
        require(!campaign.finalized, CampaignFinalized());
        require(_vestingStart >= block.timestamp, NotAllowedStartCampaignInPast());
        require(_durationInDays > 0, DurationMustBeNotNull());

        uint vestingEnd = _vestingStart + (SECONDS_IN_DAY * _durationInDays);

        campaign.finalized = true;
        campaign.vestingStart = _vestingStart;
        campaign.vestingEnd = vestingEnd;
    }

    /**
     * @notice Claims vested tokens from a specific airdrop campaign.
     * @dev Users can only claim up to their vested, unclaimed amount.
     * @param _airdropId The ID of the airdrop campaign.
     * @param _amountToWithdraw The amount of tokens the user wants to claim.
     */
    function claim(
        uint _airdropId,
        uint _amountToWithdraw
    ) public nonReentrant {
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
