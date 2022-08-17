// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

library MetadataLib {

    bytes private constant comma = bytes("%2C");
    bytes private constant quote = bytes("%22");
    //bytes private constant colon = bytes("%3A");
    bytes private constant join = bytes("%22%3A%22");    
    //bytes private constant open_curly = bytes("%7B");
    bytes private constant close_curly = bytes("%7D");
    bytes private constant prefix = bytes("data:application/json;charset=utf-8,%7B");    
      
    function bytes32ToBytes(bytes32 x) public pure returns (bytes memory) {
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
    
    function toHexDigit(uint8 d) public pure returns (bytes1) {
        if (0 <= d && d <= 9) {
            return bytes1(uint8(bytes1('0')) + d);
        } else if (10 <= uint8(d) && uint8(d) <= 15) {
            return bytes1(uint8(bytes1('a')) + d - 10);
        }
        revert();
        }    
        
    function toHexBytes(bytes32 arr) public pure returns (bytes memory) {
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
    
    function makeBytes(bytes32[4] memory arr) public pure returns (bytes memory){
        bytes memory b1 =  bytes32ToBytes(arr[0]);
        bytes memory b2 =  bytes32ToBytes(arr[1]);
        bytes memory b3 =  bytes32ToBytes(arr[2]);
        bytes memory b4 =  bytes32ToBytes(arr[3]);
        return abi.encodePacked(b1, b2, b3, b4);
    }    
    
    function makeBytesPart(bytes memory name, bytes memory value, bool includeComma) public pure returns (bytes memory){
        if (includeComma) {
          return abi.encodePacked(quote, name, join, value, quote, comma);
        } else {
          return abi.encodePacked(quote, name, join, value, quote);
        }
    }    
    
    function makeHashPart(bytes memory name, bytes32 value, bool includeComma) public pure returns (bytes memory){
        if (includeComma) {
          return abi.encodePacked(quote, name, join, bytes("0x"), toHexBytes(value), quote, comma);
        } else {
          return abi.encodePacked(quote, name, join, bytes("0x"), toHexBytes(value), quote);
        }
    }
    
    function makeBool(bytes memory name, bool value, bool includeComma) public pure returns (bytes memory){
        if(value)
        {
              if(includeComma){
                  return abi.encodePacked(quote, name, join, bytes("true"), quote, comma);
              } else {
                  return abi.encodePacked(quote, name, join, bytes("true"), quote);
              }
        } else {
              if(includeComma){
                  return abi.encodePacked(quote, name, join, bytes("false"), quote, comma);
              } else {
                  return abi.encodePacked(quote, name, join, bytes("false"), quote);
              }
        }
    }
   
   function makeUri(bytes32 name, bytes32 contentHash, bytes32[4] memory description, bytes32[4] memory image, bytes32 imageHash) public pure returns (string memory) {
        bytes memory b1 = makeBytesPart(bytes("name"), bytes32ToBytes(name), true);
        bytes memory b2 = makeHashPart(bytes("contentHash"), contentHash, true);
        bytes memory b3 = makeBytesPart(bytes("description"), makeBytes(description), true);
        bytes memory b4 = makeBytesPart(bytes("image"), makeBytes(image), true);
        bytes memory b5 = makeHashPart(bytes("imageHash"), imageHash, false);
        return string(abi.encodePacked(prefix, b1, b2, b3, b4, b5, close_curly));
    }

   // title and salvage title tokens will use an extra parameter for salvage
   function makeUri(bytes32 name, bytes32 contentHash, bytes32[4] memory description, bytes32[4] memory image, bytes32 imageHash, bool salvage) public pure returns (string memory) {
        bytes memory b1 = makeBytesPart(bytes("name"), bytes32ToBytes(name), true);
        bytes memory b2 = makeHashPart(bytes("contentHash"), contentHash, true);
        bytes memory b3 = makeBytesPart(bytes("description"), makeBytes(description), true);
        bytes memory b4 = makeBytesPart(bytes("image"), makeBytes(image), true);
        bytes memory b5 = makeHashPart(bytes("imageHash"), imageHash, true);
        bytes memory b6 = makeBool(bytes("salvage"), salvage, false);
        return string(abi.encodePacked(prefix, b1, b2, b3, b4, b5, b6, close_curly));
    }

}
