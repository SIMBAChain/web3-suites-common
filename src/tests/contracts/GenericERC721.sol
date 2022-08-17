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
contract GenericERC721 is
    Context,
    AccessControlEnumerable,
    ERC721Enumerable,
    ERC721Burnable,
    ERC721Pausable
{
    
    struct OnChainMetadata {
        bytes32 name;
        bytes32 contentHash;
        bytes32[4] description;
        bytes32[4] image;
        bool exists;
    }
    
    // (tokenID => on chain metadata)
    mapping (uint256 => OnChainMetadata) private _metadata;

    using Counters for Counters.Counter;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    Counters.Counter private _tokenIdTracker;
    
    bytes32 public namespace;

    /**
     * @dev Grants `DEFAULT_ADMIN_ROLE`, `MINTER_ROLE` and `PAUSER_ROLE` to the
     * account that deploys the contract.
     *
     */
    constructor(
        string memory name,
        string memory symbol,
        string memory contractNamespace
    ) ERC721(name, symbol) {
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
    function mint(address to, bytes32 contentHash, bytes32 name, bytes32[4] memory description, bytes32[4] memory image) public virtual {
        require(hasRole(MINTER_ROLE, _msgSender()), "must have minter role to mint");

        // We cannot just use balanceOf to create the new tokenId because tokens
        // can be burned (destroyed), so we need a separate counter.
        
        uint256 _tokenId = uint256(keccak256(abi.encodePacked(namespace, _tokenIdTracker.current(), contentHash)));
        
        _mint(to, _tokenId);
        _setMetadata(_tokenId, name, contentHash, description, image);
        _tokenIdTracker.increment();
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
    
    function _setMetadata(uint256 tokenId, bytes32 name, bytes32 contentHash, bytes32[4] memory description, bytes32[4] memory image) internal {
        require(hasRole(MINTER_ROLE, _msgSender()), "must have minter role to mint");
        // Check that the token exists
        require(_exists(tokenId), "token does not exist");
        OnChainMetadata storage metadataSet = _metadata[tokenId];
        metadataSet.name = name;
        metadataSet.contentHash = contentHash;
        metadataSet.description = description;
        metadataSet.image = image;
        metadataSet.exists = true;
    }
    
    function updateImage(uint256 tokenId, bytes32[4] memory image) public virtual {
        require(_isApprovedOrOwner(_msgSender(), tokenId), "must be approved to update");
        // Check that the token exists
        require(_exists(tokenId), "token does not exist");
        require(_metadata[tokenId].exists == true, "metadata does not exist");
        OnChainMetadata storage metadataSet = _metadata[tokenId];
        metadataSet.image = image;
    }
    
    bytes private constant comma = bytes("%2C");
    bytes private constant quote = bytes("%22");
    //bytes private constant colon = bytes("%3A");
    bytes private constant join = bytes("%22%3A%22");    
    //bytes private constant open_curly = bytes("%7B");
    bytes private constant close_curly = bytes("%7D");
    bytes private constant prefix = bytes("data:application/json;charset=utf-8,%7B");    
      
    function bytes32ToBytes(bytes32 x) private pure returns (bytes memory) {
        bytes memory bytesString = new bytes(32);
        uint charCount = 0;
        unchecked {
            for (uint j = 0; j < 32; j++) {
                bytes1 char = bytes1(bytes32(uint(x) * 2 ** (8 * j)));
                if (char != 0) {
                    bytesString[charCount] = char;
                    charCount++;
                }
            }
        }
        bytes memory bytesStringTrimmed = new bytes(charCount);
        for (uint j = 0; j < charCount; j++) {
            bytesStringTrimmed[j] = bytesString[j];
        }
        return bytesStringTrimmed;
    }    
    
    function toHexDigit(uint8 d) private pure returns (bytes1) {
        if (0 <= d && d <= 9) {
            return bytes1(uint8(bytes1('0')) + d);
        } else if (10 <= uint8(d) && uint8(d) <= 15) {
            return bytes1(uint8(bytes1('a')) + d - 10);
        }
        revert();
        }    
        
    function toHexBytes(bytes32 arr) private pure returns (bytes memory) {
        uint256 a = uint256(arr);
        uint count = 0;
        uint b = a;
        while (b != 0) {
            count++;
            b /= 16;
        }
        bytes memory res = new bytes(count);
        for (uint i=0; i<count; ++i) {
            b = a % 16;
            res[count - i - 1] = toHexDigit(uint8(b));
            a /= 16;
        }
        return res;
    }    
    
    function makeBytes(bytes32[4] memory arr) private pure returns (bytes memory){
        bytes memory b1 =  bytes32ToBytes(arr[0]);
        bytes memory b2 =  bytes32ToBytes(arr[1]);
        bytes memory b3 =  bytes32ToBytes(arr[2]);
        bytes memory b4 =  bytes32ToBytes(arr[3]);
        return abi.encodePacked(b1, b2, b3, b4);
    }    
    
    function makeBytesPart(bytes memory name, bytes memory value, bool includeComma) private pure returns (bytes memory){
        if (includeComma) {
          return abi.encodePacked(quote, name, join, value, quote, comma);
        } else {
          return abi.encodePacked(quote, name, join, value, quote);
        }
    }    
    
    function makeHashPart(bytes memory name, bytes32 value, bool includeComma) private pure returns (bytes memory){
        if (includeComma) {
          return abi.encodePacked(quote, name, join, bytes("0x"), toHexBytes(value), quote, comma);
        } else {
          return abi.encodePacked(quote, name, join, bytes("0x"), toHexBytes(value), quote);
        }
    }    
    
    function makeUri(uint256 tokenId) private view returns (string memory) {
        bytes memory b1 = makeBytesPart(bytes("name"), bytes32ToBytes(_metadata[tokenId].name), true);
        bytes memory b2 = makeHashPart(bytes("contentHash"), _metadata[tokenId].contentHash, true);
        bytes memory b3 = makeBytesPart(bytes("description"), makeBytes(_metadata[tokenId].description), true);
        bytes memory b4 = makeBytesPart(bytes("image"), makeBytes(_metadata[tokenId].image), false);
        return string(abi.encodePacked(prefix, b1, b2, b3, b4, close_curly));
    }    
    
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        // Check that the token exists
        require(_exists(tokenId), "token does not exist");
        require(_metadata[tokenId].exists == true, "metadata does not exist");
        return makeUri(tokenId);
    }
}
