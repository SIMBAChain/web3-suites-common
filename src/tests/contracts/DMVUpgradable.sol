// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

import "./DMVInterface.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";

/** @title DMV Upgradable Contract
  * @notice This contract holds the address of current dmv implementation
    contract. The contract is owned by an admin account. Only an
    admin account can change the interface/implementation contract addresses as
    business needs. Multiple accounts can be given the admin role.
  */
contract DMVUpgradable is AccessControlEnumerable{

    address private dmvImpl;
    address private dmvInterface;
    // initDone ensures that init can be called only once
    bool public initDone;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
   
    /** @notice constructor
      */
    constructor () {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(ADMIN_ROLE, _msgSender());   
        initDone = false;
    }

    /** @notice confirms that the caller is the admin account
    */
    modifier onlyAdmin {
        require(hasRole(ADMIN_ROLE, _msgSender()), "must have admin role");
        _;
    }

    /** @notice executed by admin. Links interface and implementation contract
        addresses. Can be executed by admin account only
      * @param _dmvInterface dmv interface contract address
      * @param _dmvImpl implementation contract address
      */
    function init(address _dmvInterface, address _dmvImpl) external
    onlyAdmin {
        require(!initDone, "can be executed only once");
        dmvImpl = _dmvImpl;
        dmvInterface = _dmvInterface;
        _setImpl(dmvImpl);
        initDone = true;
    }

    /** @notice changes the implementation contract address to the new address
        address passed. Can be executed by admin account only
      * @param _proposedImpl address of the new dmv implementation contract
      */
    function confirmImplChange(address _proposedImpl) public
    onlyAdmin {
        dmvImpl = _proposedImpl;
        _setImpl(dmvImpl);
    }
    
    function confirmInterfaceChange(address _proposedInterface) public
    onlyAdmin {
        dmvInterface = _proposedInterface;
        DMVInterface(dmvInterface).setDMVImplementation(dmvImpl);
    }

    /** @notice function to fetch the current implementation address
      * @return dmv implementation contract address
      */
    function getDMVImpl() public view returns (address) {
        return dmvImpl;
    }
    /** @notice function to fetch the interface address
      * @return dmv interface contract address
      */
    function getDMVInterface() public view returns (address) {
        return dmvInterface;
    }

    /** @notice function to set the dmv implementation contract address
        in the dmv interface contract
      * @param _dmvImpl dmv implementation contract address
      */
    function _setImpl(address _dmvImpl) private {
        DMVInterface(dmvInterface).setDMVImplementation(_dmvImpl);
    }

}

