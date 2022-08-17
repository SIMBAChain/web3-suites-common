// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

// SEP Imports
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Pausable.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

import "./DMVUpgradable.sol";
import "./MetadataLib.sol";

/**
 * @dev {ERC721} token, including:
 *
 *  - ability for holders to burn (destroy) their tokens
 *  - a minter role that allows for token minting (creation)
 *  - token ID and URI autogeneration
 *
 * This contract uses {AccessControl} to lock permissioned functions using the
 * different roles - head to its documentation for details.
 *
 * The account that deploys the contract will be granted the minter and pauser
 * roles, as well as the default admin role, which will let it grant both minter
 * and pauser roles to other accounts.
 */
contract CertificateOfSalvageERC721 is
    Context,
    AccessControlEnumerable,
    ERC721Enumerable,
    ERC721Burnable,
    ERC721Pausable
{
    DMVUpgradable private dmvUpgradable;
    address public dmvUpgradableAddr;	
    
    struct OnChainMetadata {
        bytes32 name;
        bytes32 contentHash;
        bytes32[4] description;
        bytes32[4] image;
        bytes32 imageHash;
        bool exists;
    }
    
    // (tokenID => on chain metadata)
    mapping (uint256 => OnChainMetadata) private _metadata;

    using Counters for Counters.Counter;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    Counters.Counter private _tokenIdTracker;
    
    bytes32 public namespace;
    
    /** @notice confirms that the caller is the address of implementation
         contract
    */
    modifier onlyImplementation {
        require(msg.sender == dmvUpgradable.getDMVImpl(), "invalid caller");
        _;
    }

    /**
     * @dev Grants `DEFAULT_ADMIN_ROLE`, `MINTER_ROLE` and `PAUSER_ROLE` to the
     * account that deploys the contract.
     *
     */
    constructor(
        string memory name,
        string memory symbol,
        string memory contractNamespace,
        address _dmvUpgradable
    ) ERC721(name, symbol) {
        dmvUpgradableAddr = _dmvUpgradable;
        dmvUpgradable = DMVUpgradable(_dmvUpgradable);
        namespace = keccak256(abi.encodePacked(contractNamespace));
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(MINTER_ROLE, _msgSender());
    }

    /**
     * @dev Creates a new token for `to`. Its token ID will be automatically
     * assigned (and available on the emitted {IERC721-Transfer} event)
     *
     * See {ERC721-_mint}.
     *
     * Requirements:
     *
     * - the caller must have the `MINTER_ROLE`.
     */
    function mint(address to, uint256 tokenId, bytes32 contentHash, bytes32 name, bytes32[4] memory description, bytes32[4] memory image, bytes32 imageHash) public virtual onlyImplementation {
        require(hasRole(MINTER_ROLE, _msgSender()), "must have minter role to mint");

        // We cannot just use balanceOf to create the new tokenId because tokens
        // can be burned (destroyed), so we need a separate counter.
        
        _mint(to, tokenId);
        _setMetadata(tokenId, name, contentHash, description, image, imageHash);
        _tokenIdTracker.increment();
    }
    
    function transferFrom(address from, address to, uint256 tokenId) public override onlyImplementation {
        // can only be called from implementation contract or an owner/operator
        require((msg.sender == dmvUpgradable.getDMVImpl()) || _isApprovedOrOwner(_msgSender(), tokenId), "invalid caller");
        _transfer(from, to, tokenId);
    }
    
    function burn(uint256 tokenId) public override onlyImplementation {
        // can only be called from implementation contract or an owner/operator
        require((msg.sender == dmvUpgradable.getDMVImpl()) || _isApprovedOrOwner(_msgSender(), tokenId), "invalid caller");
        _burn(tokenId);
    }

    /**
     * @dev Pauses all token transfers.
     *
     * See {ERC721Pausable} and {Pausable-_pause}.
     *
     * Requirements:
     *
     * - the caller must have the `DEFAULT_ADMIN_ROLE`.
     */
    function pause() public virtual {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "must have admin role to pause");
        _pause();
    }

    /**
     * @dev Unpauses all token transfers.
     *
     * See {ERC721Pausable} and {Pausable-_unpause}.
     *
     * Requirements:
     *
     * - the caller must have the `DEFAULT_ADMIN_ROLE`.
     */
    function unpause() public virtual {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "must have admin role to unpause");
        _unpause();
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual override(ERC721, ERC721Enumerable, ERC721Pausable) {
        super._beforeTokenTransfer(from, to, tokenId);
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(AccessControlEnumerable, ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
    
    function _setMetadata(uint256 tokenId, bytes32 name, bytes32 contentHash, bytes32[4] memory description, bytes32[4] memory image, bytes32 imageHash) internal {
        require(hasRole(MINTER_ROLE, _msgSender()), "must have minter role to mint");
        // Check that the token exists
        require(_exists(tokenId), "token does not exist");
        OnChainMetadata storage metadataSet = _metadata[tokenId];
        metadataSet.name = name;
        metadataSet.contentHash = contentHash;
        metadataSet.description = description;
        metadataSet.image = image;
        metadataSet.imageHash = imageHash;
        metadataSet.exists = true;
    }
    
    // updates image (URL) and imageHash at same time
    function updateImage(uint256 tokenId, bytes32[4] memory image, bytes32 imageHash) public virtual onlyImplementation {
        // can only be called from implementation contract or an owner/operator
        require((msg.sender == dmvUpgradable.getDMVImpl()) || _isApprovedOrOwner(_msgSender(), tokenId), "invalid caller");
        // Check that the token exists
        require(_exists(tokenId), "token does not exist");
        require(_metadata[tokenId].exists == true, "metadata does not exist");
        OnChainMetadata storage metadataSet = _metadata[tokenId];
        metadataSet.image = image;
        metadataSet.imageHash = imageHash;
    }
    
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        // Check that the token exists
        require(_exists(tokenId), "token does not exist");
        require(_metadata[tokenId].exists == true, "metadata does not exist");
        return MetadataLib.makeUri(_metadata[tokenId].name, _metadata[tokenId].contentHash, _metadata[tokenId].description, _metadata[tokenId].image, _metadata[tokenId].imageHash);
    }
    
    function getName(uint256 tokenId) public view returns (string memory) {
        return string(abi.encodePacked(MetadataLib.bytes32ToBytes(_metadata[tokenId].name)));
    }
    
}
