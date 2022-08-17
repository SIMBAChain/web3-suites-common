pragma experimental ABIEncoderV2;
pragma solidity 0.5.16;
//import "./NFTAuction.sol";
// For the auction functionality, I based it off of a docs.solidity blueprint to ensure I have incorporated the latest security recommendations.
// https://docs.soliditylang.org/en/v0.5.11/solidity-by-example.html
contract ERC721 {
    // source https://ethereum.org/en/developers/docs/standards/tokens/erc-721/
    function balanceOf(address _owner) external view returns (uint256);
    function ownerOf(uint256 _tokenId) external view returns (address);
    function safeTransferFrom(
        address _from,
        address _to,
        uint256 _tokenId,
        bytes calldata data
    ) external payable;
    function safeTransferFrom(
        address _from,
        address _to,
        uint256 _tokenId
    ) external payable;
    function transferFrom(
        address _from,
        address _to,
        uint256 _tokenId
    ) external payable;
    function approve(address _approved, uint256 _tokenId) external payable;
    function setApprovalForAll(address _operator, bool _approved) external;
    function getApproved(uint256 _tokenId) external view returns (address);
    function isApprovedForAll(address _owner, address _operator)
        external
        view
        returns (bool);
    event Transfer(
        address indexed _from,
        address indexed _to,
        uint256 indexed _tokenId
    );
    event Approval(
        address indexed _owner,
        address indexed _approved,
        uint256 indexed _tokenId
    );
    event ApprovalForAll(
        address indexed _owner,
        address indexed _operator,
        bool _approved
    );
}
contract NFT is ERC721 {
    // Payable address for the owner
    address payable owner;
    address auctionNFTaddress;
    // ended is for the auction end function.
    // By default initialized to `false`.
    bool ended;
    // the id for each NFT
    uint256 id;
    uint256 public highestBid;
    address payable highestBidder;
    uint256 public start_time;
    uint256 public end_time;
    uint256 auctionListedCount;
    uint256 auctionBidCount;
    // Keep track of marketplace size;
    uint256 nftSoldCount;
    //NFT Info
    string public name = "NFT for Goldman Sachs";
    string public symbol = "GS-NFT";
    // Default state
    State constant defaultState = State.Created;
    // Lifecycle of NFT
    enum State {
        Created, // 0
        InterfaceSet, //1
        Listed, // 2
        Bid, // 3
        Sold, // 4
        ReSold // 5
    }
    address[] bidders;
    // Allowed withdrawals of previous bids
    mapping(address => uint256) pendingReturns;
    // Details included in the NFT token
    struct Item {
        uint256 id;
        string title;
        string description;
        uint256 price;
        string prevOwnerName;
        address payable prevOwner;
        string ownerName;
        address payable buyer;
        address payable owner;
        State itemState;
    }
    struct AuctionTxn {
        uint256 id;
        uint256 bid;
        address payable seller;
        address payable buyer;
        State auctionState;
    }
    // Public mapping 'items' that maps the NFT to an Item.
    mapping(uint256 => Item) items;
    mapping(uint256 => AuctionTxn) auctions;
    mapping(uint256 => address) private _nftOwner;
    mapping(uint256 => address) private _nftApprovals;
    mapping(address => mapping(address => bool)) private _allApprovals;
    // Define events with the same state values and accept 'pn' as input argument
    event NFTCreated(
        uint256 id,
        string title,
        string ownerName,
        uint256 price,
        address payable owner,
        State itemState
    );
    event NFTListed(
        uint256 id,
        string title,
        uint256 price,
        address payable owner,
        uint256 end_time
    );
    event NFTSold(
        uint256 id,
        string title,
        string ownerName,
        uint256 price,
        address payable owner,
        State itemState
    );
    event BidEvent(address indexed highestBidder, uint256 highestBid);
    event AuctionEndedEvent(address winner, uint256 amount);
    event WithdrawalEvent(address withdrawer, uint256 amount);
    event SetInterfaceEvent(address contractInterface);
    // Only the owner can create a new NFT
    // Checks to see if payable(msg.sender) == owner of the contract
    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }
    modifier onlyBuyer() {
        require(msg.sender != owner);
        _;
    }
    modifier openAuction() {
        require(block.timestamp <= end_time);
        _;
    }
    constructor() public payable {
        owner = msg.sender;
        nftSoldCount = 1;
        id = 1;
        auctionListedCount = 0;
        highestBid = 0;
        start_time = 0;
        auctionBidCount = 0;
    }
    function mint(
        string memory _title,
        string memory _description,
        string memory _ownerName,
        uint256 _price
    ) public onlyOwner {
        require(bytes(_title).length > 0, "Please enter a title");
        require(bytes(_description).length > 0, "Please enter a description");
        require(_price > 0, "Please enter a price");
        require(bytes(_ownerName).length > 0, "Please enter the owner name");
        // Create the NFT Struct
        Item memory newItem;
        newItem.id = id;
        newItem.title = _title;
        newItem.description = _description;
        newItem.ownerName = _ownerName;
        newItem.price = _price;
        newItem.owner = msg.sender;
        items[id] = newItem;
        // Create the Auction Struct
        AuctionTxn memory newAuction;
        newAuction.id = id;
        newAuction.bid = _price;
        newAuction.seller = msg.sender;
        auctions[id] = newAuction;
        emit NFTCreated(
            id,
            _title,
            _ownerName,
            _price,
            msg.sender,
            State.Created
        );
        id++;
    }
    function listNFT(uint256 _tokenId, uint256 _duration) public onlyOwner {
        items[_tokenId].itemState = State.Listed;
        // update state variables
        highestBid = items[_tokenId].price;
        start_time = block.timestamp;
        end_time = start_time + _duration;
        emit NFTListed(
            _tokenId,
            items[_tokenId].title,
            highestBid,
            items[_tokenId].owner,
            end_time
        );
    }
    function bidNFT(uint256 _tokenId) public payable onlyBuyer {
        require(msg.value > highestBid, "There already is a higher bid.");
        require(msg.value >= items[_tokenId].price);
        items[_tokenId].itemState = State.Bid;
        highestBidder = msg.sender;
        highestBid = msg.value;
        bidders.push(msg.sender);
        auctions[_tokenId].bid = msg.value;
        auctions[_tokenId].buyer = msg.sender;
    }
    // called by the asset owner to transfer asset after auction is over
    function auctionEnd(uint256 _tokenId) public onlyOwner {
        // 1. Checks
        // require(block.timestamp >= end_time, "The auction is still in progress.");
        require(!ended, "auctionEnd has already been called.");
        require(items[_tokenId].owner != highestBidder);
        address payable _owner = items[_tokenId].owner;
        // 2. Effects
        ended = true;
        // Update the NFT Token Struct
        //Update the Auction Struct
        //        items[_tokenId].itemState = State.Sold;
        // 3. Interaction
        // Most re-entrancy attacks involve send, transfer, and call functions
        // send and transfer functions are considered safer because of the gas limit of 2300.
        //transfer ownership of token
        _transfer(_owner, highestBidder, _tokenId);
        //send funds
        _owner.transfer(highestBid);
        emit AuctionEndedEvent(highestBidder, highestBid);
    }
    // This pattern is recommended by solidity due to the DAO hack
    // https://docs.soliditylang.org/en/latest/security-considerations.html
    function withdraw() public returns (bool) {
        // * Checks -> assert and require functions
        require(
            ended,
            "The auction has not ended.  Withdrawals will be available post auction"
        );
        require(
            msg.sender != highestBidder,
            "You won the auction and payments are non-refundable"
        );
        // * Effects -> If the checks pass, the function should then resolve all the effects to the state of the contract.
        uint256 amount = pendingReturns[msg.sender];
        // Setting the balance to zero before calling the send function is the main corrective action from he DAO Hack
        if (amount > 0) {
            // It is important to set this to zero because the recipient
            // can call this function again as part of the receiving call
            // before `send` returns.
            pendingReturns[msg.sender] = 0;
            // * Interaction -> Only after all state changes are resolved the external function is called.
            msg.sender.transfer(amount);
            emit WithdrawalEvent(msg.sender, amount);
            return true;
        }
    }
    function fetchToken(uint256 _tokenId)
        public
        view
        returns (
            uint256 fetchedID,
            string memory title,
            string memory description,
            uint256 price,
            State itemState,
            address payable currentOwner,
            string memory ownerName
        )
    {
        fetchedID = items[_tokenId].id;
        title = items[_tokenId].title;
        description = items[_tokenId].description;
        price = items[_tokenId].price;
        itemState = items[_tokenId].itemState;
        currentOwner = items[_tokenId].owner;
        ownerName = items[_tokenId].ownerName;
        return (
            fetchedID,
            title,
            description,
            price,
            itemState,
            currentOwner,
            ownerName
        );
    }
    function fetchBid(uint256 _tokenId)
        public
        view
        returns (
            uint256 fetchedID,
            uint256 bid,
            address payable seller,
            address payable buyer
        )
    {
        fetchedID = auctions[_tokenId].id;
        bid = auctions[_tokenId].bid;
        seller = auctions[_tokenId].seller;
        buyer = auctions[_tokenId].buyer;
        return (fetchedID, bid, seller, buyer);
    }
    // this uses a pragma that is experimental in solidity 5 put standard in solidity 6.
    // I am using solidity 5 due to some restrictions on my personal computer.
    function getTokens() external view returns (Item[] memory) {
        Item[] memory _nftCount = new Item[](id);
        for (uint256 i = 0; i < id; i++) {
            _nftCount[i] = items[i];
        }
        return _nftCount;
    }
    function _transfer(
        address _from,
        address _to,
        uint256 _tokenId
    ) private {
        _nftOwner[_tokenId] = _to;
        items[_tokenId].prevOwner = items[_tokenId].owner;
        items[_tokenId].prevOwnerName = items[_tokenId].ownerName;
        items[_tokenId].buyer = highestBidder;
        items[_tokenId].owner = highestBidder;
        items[_tokenId].itemState = State.Sold;
        emit Transfer(_from, _to, _tokenId);
    }
    function _exists(uint256 tokenId) internal view returns (bool) {
        address _owner = _nftOwner[tokenId];
        return _owner != address(0);
    }
    function balanceOf(address _owner) public view returns (uint256) {
        //return _ownedTokensCount[_owner];
    }
    function ownerOf(uint256 _tokenId) public view returns (address _owner) {
        _owner = _nftOwner[_tokenId];
    }
    function approve(address _to, uint256 _tokenId) external payable {
        require(ownerOf(_tokenId, msg.sender));
        _nftApprovals[_tokenId] = _to;
        emit Approval(msg.sender, _to, _tokenId);
    }
    function transferFrom(
        address _from,
        address _to,
        uint256 _tokenId
    ) external payable {
        require(_to != address(0));
        require(ownerOf(_tokenId, _from));
        require(isApproved(_to, _tokenId));
        _transfer(_from, _to, _tokenId);
    }
    function transfer(address _to, uint256 _tokenId) public {
        require(_to != address(0));
        require(ownerOf(_tokenId, msg.sender));
        _transfer(msg.sender, _to, _tokenId);
    }
    function getApproved(uint256 tokenId)
        public
        view
        returns (address operator)
    {
        require(_exists(tokenId));
        return _nftApprovals[tokenId];
    }
    function setApprovalForAll(address operator, bool _approved) public {
        require(operator != msg.sender);
        _allApprovals[msg.sender][operator] = _approved;
        emit ApprovalForAll(msg.sender, operator, _approved);
    }
    function isApprovedForAll(address _owner, address operator)
        public
        view
        returns (bool)
    {
        return _allApprovals[_owner][operator];
    }
    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) external payable {
        // N/A
    }
    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes calldata data
    ) external payable {
        // N/A
    }
    //*###
    function ownerOf(uint256 tokenId, address account)
        public
        view
        returns (bool)
    {
        address _owner = _nftOwner[tokenId];
        //require(owner != address(0));
        return _owner == account;
    }
    function isApproved(address _to, uint256 _tokenId)
        private
        view
        returns (bool)
    {
        return _nftApprovals[_tokenId] == _to;
    }
    // Next Steps - Refactor Code w/Seperate Contracts and Interfaces
    /*function setInterface(uint256 _tokenId, address _auctionNFTaddress)
        external
    {
        auctionNFTaddress = _auctionNFTaddress;
        items[_tokenId].itemState = State.InterfaceSet;
        emit SetInterfaceEvent(_auctionNFTaddress);
    }*/
    //Let's check to see if the interface works.
    /* function listNFTInterface(uint256 _tokenId, uint256 _duration) public {
        items[_tokenId].itemState = State.Listed;
        InterfaceNFTAuction n = InterfaceNFTAuction(auctionNFTaddress);
        n.listAuction(
            items[_tokenId].id,
            items[_tokenId].title,
            items[_tokenId].description,
            items[_tokenId].price,
            items[_tokenId].owner,
            _duration
        );
        // emit NFTSold(_tokenId,_title,  _authorName,_price, _author,_current_owner,payable(msg.sender);
    }*/
}