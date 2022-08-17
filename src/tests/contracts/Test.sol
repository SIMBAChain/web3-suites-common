// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Test {

    uint256 public balance;
    address public owner;
    address payable public seller;
    address payable public buyer;


    constructor () { // address for smart contract
        owner = msg.sender; //person who calls the smart contract

    }

    receive ()external payable {
        balance += msg.value; // shows how much money is inside the contract 

    }

}