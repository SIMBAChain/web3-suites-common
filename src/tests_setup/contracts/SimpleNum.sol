//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

contract SimpleNum {
    uint private ourNum;

    constructor(uint _ourNum) {
        ourNum = _ourNum;
    }

    function getNum() public view returns (uint) {
        return ourNum;
    }

    function setNum(uint _ourNum) public {
        ourNum = _ourNum;
    }
}
