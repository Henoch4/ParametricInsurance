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
    // FIX: expose owner() so owner-oracle checks (triggerEvent) can compare against it.
    function owner() public view returns (address) { return _owner; }
}

// FIX (ID convention): all IDs are 1-BASED. Event id E and policy id P refer to
// array slots `events[E - 1]` and `policies[P - 1]`. Id 0 is never valid. This keeps
// createEvent/buyPolicy return values aligned with what claim/refund/reads expect.
contract ParametricInsurance is ReentrancyGuard, Ownable {
    uint256 public constant MAX_PREMIUM_BPS = 5_000; // FIX: cap configurable premium at 50% of cover, sanity guard for setPremiumBps

    struct Policy {
        address holder;
        uint256 premium;
        uint256 coverAmount;
        uint256 eventId; // 1-based event id
        bool claimed;
        bool active;
    }

    struct Event {
        uint256 id; // 1-based
        string description;
        uint256 triggerTimestamp;
        bool triggered;
        address oracle; // address allowed to call triggerEvent (contract owner may always trigger)
    }

    Policy[] public policies;
    Event[] public events;
    // FIX: maps 1-based event id -> list of 1-based policy ids bought for that event.
    mapping(uint256 => uint256[]) public eventPolicyIds;

    uint256 public totalPremiums;
    uint256 public totalPayouts;
    // FIX: configurable premium in bps of cover (default 3% = 300 bps, replaces the
    // inverted 105% charge). Owner-only setter, capped by MAX_PREMIUM_BPS.
    uint256 public premiumBps = 300;

    event PolicyCreated(uint256 indexed pid, address indexed holder, uint256 premium, uint256 coverAmount, uint256 eventId);
    event EventCreated(uint256 indexed id, string description, address indexed oracle);
    event EventTriggered(uint256 indexed id);
    event PolicyClaimed(uint256 indexed pid, address indexed holder, uint256 payout);
    event PolicyRefunded(uint256 indexed pid, address indexed holder, uint256 premium);

    constructor() Ownable() {}

    // FIX: reserve is funded by premiums paid through buyPolicy; receive() only allows
    // extra top-ups so claims can never strand for lack of gas funds. All exits are
    // user claims (pull payments), so the contract can never become a lockbox.
    receive() external payable {}

    function setPremiumBps(uint256 bps) external onlyOwner {
        require(bps > 0 && bps <= MAX_PREMIUM_BPS, "Premium bps out of range");
        premiumBps = bps;
    }

    function createEvent(string memory description, uint256 ts, address _oracle) external onlyOwner returns (uint256) {
        require(_oracle != address(0), "Zero oracle");
        require(ts > block.timestamp, "Event must be future");
        // FIX: 1-based id (first event is id 1); array slot is id - 1.
        uint256 id = events.length + 1;
        events.push(Event({id: id, description: description, triggerTimestamp: ts, triggered: false, oracle: _oracle}));
        emit EventCreated(id, description, _oracle);
        return id;
    }

    function buyPolicy(uint256 id, uint256 cover) external payable nonReentrant {
        // FIX: 1-based bounds check; previously raw array indexing let id 0 read garbage.
        require(id >= 1 && id <= events.length, "Bad event id");
        Event storage e = events[id - 1];
        require(!e.triggered, "Already triggered");
        require(cover > 0, "Zero cover");
        // FIX: premium is now a small configurable bps of cover (default 3%), not 105%.
        uint256 prem = cover * premiumBps / 10_000;
        require(prem > 0, "Zero premium");
        require(msg.value == prem, "Premium mismatch");
        // FIX: 1-based policy id; its array slot is pid - 1.
        uint256 pid = policies.length + 1;
        policies.push(Policy({holder: msg.sender, premium: prem, coverAmount: cover, eventId: id, claimed: false, active: true}));
        eventPolicyIds[id].push(pid);
        totalPremiums += prem;
        emit PolicyCreated(pid, msg.sender, prem, cover, id);
    }

    // FIX: trigger authority is verifiable — the event's registered oracle OR the
    // contract owner (owner-oracle path for demos). Triggering only flips state;
    // payouts flow to policyholders through pull-payment claims, so a holder whose
    // call would fail is never denied their payout by a push loop.
    function triggerEvent(uint256 id) external {
        require(id >= 1 && id <= events.length, "Bad event id");
        Event storage e = events[id - 1];
        require(msg.sender == e.oracle || msg.sender == owner(), "Not oracle");
        require(!e.triggered, "Already triggered");
        require(block.timestamp >= e.triggerTimestamp, "Too early");
        e.triggered = true;
        emit EventTriggered(id);
    }

    // FIX: claim is a holder-only pull payment with call{value} (was open-to-all
    // transfer()), plus a reserve check so payouts are always covered by the pool.
    function claimPolicy(uint256 pid) external nonReentrant {
        require(pid >= 1 && pid <= policies.length, "Bad policy id");
        Policy storage p = policies[pid - 1];
        require(msg.sender == p.holder, "Not holder");
        require(p.active && !p.claimed, "Not claimable");
        require(events[p.eventId - 1].triggered, "Not triggered");
        uint256 amt = p.coverAmount;
        require(address(this).balance >= amt, "Insufficient reserve");
        p.claimed = true;
        p.active = false;
        totalPayouts += amt;
        (bool ok, ) = p.holder.call{value: amt}("");
        require(ok, "Payout failed");
        emit PolicyClaimed(pid, p.holder, amt);
    }

    // FIX: refund is now a holder-only cancel while the event is still untriggered
    // (premium returned via call{value}); the old version handed premiums back after
    // the event had triggered, draining the payout reserve. Reserve-checked.
    function refundPolicy(uint256 pid) external nonReentrant {
        require(pid >= 1 && pid <= policies.length, "Bad policy id");
        Policy storage p = policies[pid - 1];
        require(msg.sender == p.holder, "Not holder");
        require(p.active && !p.claimed, "Not claimable");
        require(!events[p.eventId - 1].triggered, "Already triggered");
        uint256 prem = p.premium;
        require(address(this).balance >= prem, "Insufficient reserve");
        p.active = false;
        totalPremiums -= prem;
        (bool ok, ) = p.holder.call{value: prem}("");
        require(ok, "Refund failed");
        emit PolicyRefunded(pid, p.holder, prem);
    }

    // 1-based convenience getters (the public `events`/`policies` arrays remain raw
    // 0-based solidity arrays).
    function getEvent(uint256 id) external view returns (Event memory) {
        require(id >= 1 && id <= events.length, "Bad event id");
        return events[id - 1];
    }

    function getPolicy(uint256 pid) external view returns (Policy memory) {
        require(pid >= 1 && pid <= policies.length, "Bad policy id");
        return policies[pid - 1];
    }

    function getPoliciesForEvent(uint256 id) external view returns (uint256[] memory) {
        require(id >= 1 && id <= events.length, "Bad event id");
        return eventPolicyIds[id];
    }
}
