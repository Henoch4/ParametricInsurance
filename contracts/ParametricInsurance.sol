// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

abstract contract ReentrancyGuard {
    bool private _nonReentrant;
    constructor() { _nonReentrant = false; }
    modifier nonReentrant() {
        require(!_nonReentrant, "ReentrancyGuard: reentrant call");
        _nonReentrant = true;
        _;
        _nonReentrant = false;
    }
}

abstract contract Ownable {
    address private _owner;
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    constructor() {
        _owner = msg.sender;
        emit OwnershipTransferred(address(0), _owner);
    }
    modifier onlyOwner() {
        require(_owner == msg.sender, "Ownable: caller is not the owner");
        _;
    }
}

contract ParametricInsurance is ReentrancyGuard, Ownable {
    struct Policy {
        address holder;
        uint256 premium;
        uint256 coverAmount;
        uint256 eventId;
        bool claimed;
        bool active;
    }

    struct Event {
        uint256 id;
        string description;
        uint256 triggerTimestamp;
        bool triggered;
        address oracle;
    }

    Policy[] public policies;
    Event[] public events;
    mapping(uint256 => uint256[]) public eventPolicyIds;

    uint256 public totalPremiums;
    uint256 public totalPayouts;

    event PolicyCreated(uint256 indexed pid, address indexed holder, uint256 premium, uint256 coverAmount, uint256 eventId);
    event EventCreated(uint256 indexed id, string description, address indexed oracle);
    event EventTriggered(uint256 indexed id);
    event PolicyClaimed(uint256 indexed pid, address indexed holder, uint256 payout);

    constructor() Ownable() {}

    function createEvent(string memory description, uint256 ts, address _oracle) external onlyOwner returns (uint256) {
        require(_oracle != address(0), "Zero oracle");
        require(ts > block.timestamp, "Event must be future");
        Event storage e = events.push();
        e.id = events.length;
        e.description = description;
        e.triggerTimestamp = ts;
        e.oracle = _oracle;
        e.triggered = false;
        emit EventCreated(e.id, description, _oracle);
        return e.id;
    }

    function buyPolicy(uint256 id, uint256 cover) external payable nonReentrant {
        Event storage e = events[id];
        require(!e.triggered, "Already triggered");
        require(cover > 0, "Zero cover");
        uint256 prem = cover * (10500) / 10000;
        require(msg.value == prem, "Premium mismatch");
        Policy storage p = policies.push();
        p.holder = msg.sender;
        p.premium = prem;
        p.coverAmount = cover;
        p.eventId = id;
        p.claimed = false;
        p.active = true;
        uint256 pid = policies.length - 1;
        eventPolicyIds[id].push(pid);
        totalPremiums += prem;
        emit PolicyCreated(pid, msg.sender, prem, cover, id);
    }

    function triggerEvent(uint256 id) external {
        Event storage e = events[id];
        require(msg.sender == e.oracle, "Not oracle");
        require(!e.triggered, "Already triggered");
        require(block.timestamp >= e.triggerTimestamp, "Too early");
        e.triggered = true;
        uint256[] memory pids = eventPolicyIds[id];
        for (uint256 i = 0; i < pids.length; i++) {
            Policy storage p = policies[pids[i]];
            if (p.active && !p.claimed) {
                p.claimed = true;
                p.active = false;
                uint256 amt = p.coverAmount;
                totalPayouts += amt;
                payable(p.holder).transfer(amt);
                emit PolicyClaimed(pids[i], p.holder, amt);
            }
        }
    }

    function claimPolicy(uint256 pid) external {
        Policy storage p = policies[pid];
        require(p.active && !p.claimed, "Not claimable");
        Event storage e = events[p.eventId];
        require(e.triggered, "Not triggered");
        p.claimed = true;
        p.active = false;
        uint256 amt = p.coverAmount;
        totalPayouts += amt;
        payable(p.holder).transfer(amt);
        emit PolicyClaimed(pid, p.holder, amt);
    }

    function refundPolicy(uint256 pid) external {
        Policy storage p = policies[pid];
        require(p.active && !p.claimed, "Not claimable");
        Event storage e = events[p.eventId];
        require(e.triggered, "Not triggered");
        require(block.timestamp >= e.triggerTimestamp + 30 days, "Window not open");
        p.active = false;
        uint256 prem = p.premium;
        totalPremiums -= prem;
        payable(p.holder).transfer(prem);
    }
}
