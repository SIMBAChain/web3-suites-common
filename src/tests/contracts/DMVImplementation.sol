// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

import "./DMVUpgradable.sol";
import "./CarERC721.sol";
import "./TitleERC721.sol";
import "./RegistrationERC721.sol";
import "./CertificateOfSalvageERC721.sol";

/** @title DMV Implementation Contract
  * @notice This contract holds implementation logic for all dmv
    related functionality. This can be called only by the interface
    contract.
  */
contract DMVImplementation {
    DMVUpgradable private dmvUpgradable;
    CarERC721 private carERC721;
    TitleERC721 private titleERC721;
    RegistrationERC721 private registrationERC721;
    CertificateOfSalvageERC721 private certificateOfSalvageERC721;

    /** @notice modifier to confirm that caller is the interface contract
      */
    modifier onlyInterface{
        require(msg.sender == dmvUpgradable.getDMVInterface(),
            "can be called by interface contract only");
        _;
    }
    /** @notice modifier to confirm that caller is the upgradable contract
      */
    modifier onlyUpgradeable {
        require(msg.sender == address(dmvUpgradable), "invalid caller");
        _;
    }

    constructor (address _dmvUpgradable, address _carERC721, address _titleERC721, address _registrationERC721, address _certificateOfSalvageERC721
        ) {
        dmvUpgradable = DMVUpgradable(_dmvUpgradable);
        carERC721 = CarERC721(_carERC721);
        titleERC721 = TitleERC721(_titleERC721);
        registrationERC721 = RegistrationERC721(_registrationERC721);
        certificateOfSalvageERC721 = CertificateOfSalvageERC721(_certificateOfSalvageERC721);
    }
    
    // car functions
    
    function createCar(address to, uint256 tokenId, bytes32 contentHash, bytes32 name, bytes32[4] memory description, bytes32[4] memory image, bytes32 imageHash) external onlyInterface {
        carERC721.mint(to, tokenId, contentHash, name, description, image, imageHash);
    }
    
    function updateCarImage(uint256 tokenId, bytes32[4] memory image, bytes32 imageHash) external onlyInterface {
        carERC721.updateImage(tokenId, image, imageHash);
    }
    
    function getCarMetadata(uint256 tokenId) public view onlyInterface returns (string memory)
    {
        return carERC721.tokenURI(tokenId);
    }
    
    function getVIN(uint256 tokenId) public view onlyInterface returns (string memory)
    {
        return carERC721.getName(tokenId);
    }
    
    function burnCar(uint256 tokenId) external onlyInterface {
        carERC721.burn(tokenId);
    }
    
    function transferCar(address from, address to, uint256 tokenId) external onlyInterface {
        carERC721.transferFrom(from, to, tokenId);
    }
    
    // title functions
    
    function createTitle(address to, uint256 tokenId, bytes32 contentHash, bytes32 name, bytes32[4] memory description, bytes32[4] memory image, bytes32 imageHash, bool salvage) external onlyInterface {
        titleERC721.mint(to, tokenId, contentHash, name, description, image, imageHash, salvage);
    }
    
    function createNonSalvageTitle(address to, uint256 tokenId, bytes32 contentHash, bytes32 name, bytes32[4] memory description, bytes32[4] memory image, bytes32 imageHash) external onlyInterface {
        titleERC721.mint(to, tokenId, contentHash, name, description, image, imageHash, false);
    }
    
    function createSalvageTitle(address to, uint256 tokenId, bytes32 contentHash, bytes32 name, bytes32[4] memory description, bytes32[4] memory image, bytes32 imageHash) external onlyInterface {
        titleERC721.mint(to, tokenId, contentHash, name, description, image, imageHash, true);
    }
    
    function updateTitleImage(uint256 tokenId, bytes32[4] memory image, bytes32 imageHash) external onlyInterface {
        titleERC721.updateImage(tokenId, image, imageHash);
    }
    
    function getTitleMetadata(uint256 tokenId) public view onlyInterface returns (string memory)
    {
        return titleERC721.tokenURI(tokenId);
    }
    
    function getTitleDocumentID(uint256 tokenId) public view onlyInterface returns (string memory)
    {
        return titleERC721.getName(tokenId);
    }
    
    function burnTitle(uint256 tokenId) external onlyInterface {
        titleERC721.burn(tokenId);
    }
    
    function transferTitle(address from, address to, uint256 tokenId) external onlyInterface {
        titleERC721.transferFrom(from, to, tokenId);
    }
    
    // registration functions
    
    function createRegistration(address to, uint256 tokenId, bytes32 contentHash, bytes32 name, bytes32[4] memory description, bytes32[4] memory image, bytes32 imageHash) external onlyInterface {
        registrationERC721.mint(to, tokenId, contentHash, name, description, image, imageHash);
    }
    
    function updateRegistrationImage(uint256 tokenId, bytes32[4] memory image, bytes32 imageHash) external onlyInterface {
        registrationERC721.updateImage(tokenId, image, imageHash);
    }
    
    function getRegistrationMetadata(uint256 tokenId) public view onlyInterface returns (string memory)
    {
        return registrationERC721.tokenURI(tokenId);
    }
    
    function getRegistrationDocumentID(uint256 tokenId) public view onlyInterface returns (string memory)
    {
        return registrationERC721.getName(tokenId);
    }
    
    function burnRegistration(uint256 tokenId) external onlyInterface {
        registrationERC721.burn(tokenId);
    }
    
    function transferRegistration(address from, address to, uint256 tokenId) external onlyInterface {
        registrationERC721.transferFrom(from, to, tokenId);
    }
    
    // certificate of salvage functions
    
    function createCertificateOfSalvage(address to, uint256 tokenId, bytes32 contentHash, bytes32 name, bytes32[4] memory description, bytes32[4] memory image, bytes32 imageHash) external onlyInterface {
        certificateOfSalvageERC721.mint(to, tokenId, contentHash, name, description, image, imageHash);
    }
    
    function updateCertificateOfSalvageImage(uint256 tokenId, bytes32[4] memory image, bytes32 imageHash) external onlyInterface {
        certificateOfSalvageERC721.updateImage(tokenId, image, imageHash);
    }
    
    function getCertificateOfSalvageMetadata(uint256 tokenId) public view onlyInterface returns (string memory)
    {
        return certificateOfSalvageERC721.tokenURI(tokenId);
    }
    
    function getCertificateOfSalvageDocumentID(uint256 tokenId) public view onlyInterface returns (string memory)
    {
        return certificateOfSalvageERC721.getName(tokenId);
    }
    
    function burnCertificateOfSalvage(uint256 tokenId) external onlyInterface {
        certificateOfSalvageERC721.burn(tokenId);
    }
    
    function transferCertificateOfSalvage(address from, address to, uint256 tokenId) external onlyInterface {
        certificateOfSalvageERC721.transferFrom(from, to, tokenId);
    }
    
}

