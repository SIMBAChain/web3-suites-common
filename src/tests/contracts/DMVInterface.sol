// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

import "./DMVImplementation.sol";
import "./DMVUpgradable.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";

/** @title DMV Interface Contract
  * @notice This contract is the interface for dmv implementation
    contract. for any call, it forwards the call to the implementation
    contract
  */
contract DMVInterface is AccessControlEnumerable {
    DMVImplementation private dmvImplementation;
    address private dmvUpgradable;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant DMV_ROLE = keccak256("DMV_ROLE");
    
    event LogCreateCar(address to, uint256 tokenId);
    event LogUpdateCarImage(uint256 tokenId, bytes32[4] image, bytes32 imageHash);
    event LogBurnCar(uint256 tokenId);
    event LogTransferCar(address from, address to, uint256 tokenId);
    
    event LogCreateTitle(address to, uint256 tokenId, bool salvage);
    event LogUpdateTitleImage(uint256 tokenId, bytes32[4] image, bytes32 imageHash);
    event LogBurnTitle(uint256 tokenId);
    event LogTransferTitle(address from, address to, uint256 tokenId);
    
    event LogCreateRegistration(address to, uint256 tokenId);
    event LogUpdateRegistrationImage(uint256 tokenId, bytes32[4] image, bytes32 imageHash);
    event LogBurnRegistration(uint256 tokenId);
    event LogTransferRegistration(address from, address to, uint256 tokenId);
    
    event LogCreateCertificateOfSalvage(address to, uint256 tokenId);
    event LogUpdateCertificateOfSalvageImage(uint256 tokenId, bytes32[4] image, bytes32 imageHash);
    event LogBurnCertificateOfSalvage(uint256 tokenId);
    event LogTransferCertificateOfSalvage(address from, address to, uint256 tokenId);
    
    /** @notice constructor
      * @param _dmvUpgradable dmv upgradable contract address
      */
    constructor(address _dmvUpgradable) {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(ADMIN_ROLE, _msgSender()); 
        dmvUpgradable = _dmvUpgradable;
    }

    /** @notice confirms that the caller is the address of upgradable
        contract
      */
    modifier onlyUpgradeable {
        require(msg.sender == dmvUpgradable, "invalid caller");
        _;
    }
    
    /** @notice confirms that the caller is the admin account
    */
    modifier onlyAdmin {
        require(hasRole(ADMIN_ROLE, _msgSender()), "must have admin role");
        _;
    }
    
    /** @notice confirms that the caller is the DMV account
    */
    modifier onlyDMV {
        require(hasRole(DMV_ROLE, _msgSender()), "must have DMV role");
        _;
    }

    /** @notice sets the dmv implementation contract address
      * can be called from upgradable contract only
      * @param _dmvImplementation dmv implementation contract address
      */
    function setDMVImplementation(address _dmvImplementation) external
    onlyUpgradeable {
        dmvImplementation = DMVImplementation(_dmvImplementation);
    }

    /** @notice returns the address of dmv implementation contract
      * @return dmv implementation contract address
      */
    function getDMVImpl() external view returns (address) {
        return address(dmvImplementation);
    }
    
    // use case functions
    
    // car functions
    
    // requires implementation contract address to be minter on token contract
    function createCar(address to, uint256 tokenId, bytes32 contentHash, bytes32 name, bytes32[4] memory description, bytes32[4] memory image, bytes32 imageHash) external onlyDMV {
        dmvImplementation.createCar(to, tokenId, contentHash, name, description, image, imageHash);
        emit LogCreateCar(to, tokenId);
    }
    
    function updateCarImage(uint256 tokenId, bytes32[4] memory image, bytes32 imageHash) external onlyDMV {
        dmvImplementation.updateCarImage(tokenId, image, imageHash);
        emit LogUpdateCarImage(tokenId, image, imageHash);
    }
    
    function getCarMetadata(uint256 tokenId) public view onlyDMV returns (string memory) {
        return dmvImplementation.getCarMetadata(tokenId);
    }
    
    function getVIN(uint256 tokenId) public view onlyDMV returns (string memory) {
        return dmvImplementation.getVIN(tokenId);
    }
    
    function burnCar(uint256 tokenId) external onlyDMV {
        dmvImplementation.burnCar(tokenId);
        emit LogBurnCar(tokenId);
    }
    
    function transferCar(address from, address to, uint256 tokenId) external onlyDMV {
        dmvImplementation.transferCar(from, to, tokenId);
        emit LogTransferCar(from, to, tokenId);
    }
    
    // title functions
    
    // requires implementation contract address to be minter on token contract
    function createTitle(address to, uint256 tokenId, bytes32 contentHash, bytes32 name, bytes32[4] memory description, bytes32[4] memory image, bytes32 imageHash, bool salvage) external onlyDMV {
        dmvImplementation.createTitle(to, tokenId, contentHash, name, description, image, imageHash, salvage);
        emit LogCreateTitle(to, tokenId, false);
    }
    
    function createNonSalvageTitle(address to, uint256 tokenId, bytes32 contentHash, bytes32 name, bytes32[4] memory description, bytes32[4] memory image, bytes32 imageHash) external onlyDMV {
        dmvImplementation.createNonSalvageTitle(to, tokenId, contentHash, name, description, image, imageHash);
        emit LogCreateTitle(to, tokenId, false);
    }
    
    function createSalvageTitle(address to, uint256 tokenId, bytes32 contentHash, bytes32 name, bytes32[4] memory description, bytes32[4] memory image, bytes32 imageHash) external onlyDMV {
        dmvImplementation.createSalvageTitle(to, tokenId, contentHash, name, description, image, imageHash);
        emit LogCreateTitle(to, tokenId, true);
    }
    
    function updateTitleImage(uint256 tokenId, bytes32[4] memory image, bytes32 imageHash) external onlyDMV {
        dmvImplementation.updateTitleImage(tokenId, image, imageHash);
        emit LogUpdateTitleImage(tokenId, image, imageHash);
    }
    
    function getTitleMetadata(uint256 tokenId) public view onlyDMV returns (string memory) {
        return dmvImplementation.getTitleMetadata(tokenId);
    }
    
    function getTitleDocumentID(uint256 tokenId) public view onlyDMV returns (string memory) {
        return dmvImplementation.getTitleDocumentID(tokenId);
    }
    
    function burnTitle(uint256 tokenId) external onlyDMV {
        dmvImplementation.burnTitle(tokenId);
        emit LogBurnTitle(tokenId);
    }
    
    function transferTitle(address from, address to, uint256 tokenId) external onlyDMV {
        dmvImplementation.transferTitle(from, to, tokenId);
        emit LogTransferTitle(from, to, tokenId);
    }
    
    // registration functions
    
    // requires implementation contract address to be minter on token contract
    function createRegistration(address to, uint256 tokenId, bytes32 contentHash, bytes32 name, bytes32[4] memory description, bytes32[4] memory image, bytes32 imageHash) external onlyDMV {
        dmvImplementation.createRegistration(to, tokenId, contentHash, name, description, image, imageHash);
        emit LogCreateRegistration(to, tokenId);
    }
    
    function updateRegistrationImage(uint256 tokenId, bytes32[4] memory image, bytes32 imageHash) external onlyDMV {
        dmvImplementation.updateRegistrationImage(tokenId, image, imageHash);
        emit LogUpdateRegistrationImage(tokenId, image, imageHash);
    }
    
    function getRegistrationMetadata(uint256 tokenId) public view onlyDMV returns (string memory) {
        return dmvImplementation.getRegistrationMetadata(tokenId);
    }
    
    function getRegistrationDocumentID(uint256 tokenId) public view onlyDMV returns (string memory) {
        return dmvImplementation.getRegistrationDocumentID(tokenId);
    }
    
    function burnRegistration(uint256 tokenId) external onlyDMV {
        dmvImplementation.burnRegistration(tokenId);
        emit LogBurnRegistration(tokenId);
    }
    
    function transferRegistration(address from, address to, uint256 tokenId) external onlyDMV {
        dmvImplementation.transferRegistration(from, to, tokenId);
        emit LogTransferRegistration(from, to, tokenId);
    }
    
    // certificate of salvage functions
    
    // requires implementation contract address to be minter on token contract
    function createCertificateOfSalvage(address to, uint256 tokenId, bytes32 contentHash, bytes32 name, bytes32[4] memory description, bytes32[4] memory image, bytes32 imageHash) external onlyDMV {
        dmvImplementation.createCertificateOfSalvage(to, tokenId, contentHash, name, description, image, imageHash);
        emit LogCreateCertificateOfSalvage(to, tokenId);
    }
    
    function updateCertificateOfSalvageImage(uint256 tokenId, bytes32[4] memory image, bytes32 imageHash) external onlyDMV {
        dmvImplementation.updateCertificateOfSalvageImage(tokenId, image, imageHash);
        emit LogUpdateCertificateOfSalvageImage(tokenId, image, imageHash);
    }
    
    function getCertificateOfSalvageMetadata(uint256 tokenId) public view onlyDMV returns (string memory) {
        return dmvImplementation.getCertificateOfSalvageMetadata(tokenId);
    }
    
    function getCertificateOfSalvageDocumentID(uint256 tokenId) public view onlyDMV returns (string memory) {
        return dmvImplementation.getCertificateOfSalvageDocumentID(tokenId);
    }
    
    function burnCertificateOfSalvage(uint256 tokenId) external onlyDMV {
        dmvImplementation.burnCertificateOfSalvage(tokenId);
        emit LogBurnCertificateOfSalvage(tokenId);
    }
    
    function transferCertificateOfSalvage(address from, address to, uint256 tokenId) external onlyDMV {
        dmvImplementation.transferCertificateOfSalvage(from, to, tokenId);
        emit LogTransferCertificateOfSalvage(from, to, tokenId);
    }
}

