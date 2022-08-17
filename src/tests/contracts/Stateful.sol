// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

/**
 * @title Base contract for state machines
 */
abstract contract Stateful {

    event Transition(
        address actor,
        uint256 indexed asset,
        bytes32 indexed fromState,
        bytes32 indexed toState
    );

    enum Strategy { STRATEGY_ANY, STRATEGY_ALL, STRATEGY_MAJORITY }

    uint256 private constant _NOT_TRANSITIONING = 1;
    uint256 private constant _TRANSITIONING = 2;
    uint256 private _status;

    uint256 private constant _MAX_NEXT_STATES = 4;
    uint256 private constant _MAX_STATES = 16;

    struct State {
        // state transition strategy
        Strategy strategy;
        // the number of unique invocations required before transition is allowed
        uint8 invocations;
        // a boolean to check if the state is actually created
        bool exists;
        // a list of states that can be transitioned to
        bytes32[] nextStates;
        // a mapping of next states for lookup
        mapping(bytes32 => bool) knownStates;
    }

    mapping(bytes32 => State) internal states;

    // asset -> fromState -> toState -> address -> bool
    mapping(uint256 => mapping(bytes32 => mapping(bytes32 => mapping(address => bool)))) confirmations;
    // asset -> fromState -> toState -> uint8
    mapping(uint256 => mapping(bytes32 => mapping(bytes32 => uint8))) confirmationCount;

    bytes32[] internal possibleStates;

    modifier stateExists(bytes32 state) {
        require(
            states[state].exists,
            "SIMBA-CODE: 4003"
        );
        _;
    }

    modifier checkNextStates(bytes32 fromState, bytes32 toState) {
        require(
            _checkNextStates(fromState, toState),
            "SIMBA-CODE: 4000"
        );
        _;
    }

    modifier nonReentrant() {
        require(_status != _TRANSITIONING, "SIMBA-CODE: 4006");
        _status = _TRANSITIONING;

        _;

        _status = _NOT_TRANSITIONING;
    }

    /**
     * @notice Checks if it is allowed to transition between the given states
     */
    function _checkNextStates(bytes32 fromState, bytes32 toState)
        private
        view
        returns (bool hasNextState)
    {
        return states[fromState].knownStates[toState];
    }

    /**
     * @notice Returns a list of all the possible states.
     */
    function getAllStates() public view returns (bytes32[] memory allStates) {
        return possibleStates;
    }

    /**
     * @notice Returns state as tuple for give state.
     */
    function getState(bytes32 state)
        public
        view
        stateExists(state)
        returns (
            string memory name,
            Strategy strategy,
            uint8 invocations,
            bytes32[] memory nextStates
        )
    {
        State storage s = states[state]; // copy to memory
        return (string(abi.encodePacked(state)), s.strategy, s.invocations, s.nextStates);
    }

    function createState(bytes32 stateName, Strategy strategy, uint8 invocations)
        internal {
        require(
            !states[stateName].exists,
            "SIMBA-CODE: 4002"
        );
        require(
            possibleStates.length < _MAX_STATES,
            "SIMBA-CODE: 4008"
        );
        State storage state = states[stateName];
        state.strategy = strategy;
        state.invocations = invocations;
        state.exists = true;
        possibleStates.push(stateName);
    }

    function addNextStateForState(bytes32 state, bytes32 nextState)
        internal
        stateExists(state)
        stateExists(nextState)
    {
        require(
            states[state].nextStates.length < _MAX_NEXT_STATES,
            "SIMBA-CODE: 4007"
        );
        states[state].nextStates.push(nextState);
        states[state].knownStates[nextState] = true;

    }

    /**
     * @notice Function that checks if we can trigger a transition between two states
     * @dev This checks if the states exist, and if the next state is valid.
     * @dev and if all the preconditions give the ok.
     */
    function _checkAllTransitionCriteria(address sender, uint256 asset, bytes32 fromState, bytes32 toState)
        private
        stateExists(fromState)
        stateExists(toState)
        checkNextStates(fromState, toState)
        returns (bool)
    {
        return _checkStrategy(sender, asset, fromState, toState);
    }

    /**
     * @notice Checks transition strategy numerically. Allowed identities are expected
     *         to have been authorized via Auth logic.
     */
    function _checkStrategy(
        address sender,
        uint256 asset,
        bytes32 fromState,
        bytes32 toState
        ) private returns (bool)
    {
        if (states[toState].strategy == Strategy.STRATEGY_ALL
                || states[toState].strategy == Strategy.STRATEGY_MAJORITY) {
            require(!confirmations[asset][fromState][toState][sender], "SIMBA-CODE: 4005");
            uint8 invocations = states[toState].invocations;
            uint8 currentInvocations = confirmationCount[asset][fromState][toState];
            currentInvocations++;
            confirmationCount[asset][fromState][toState] = currentInvocations;
            confirmations[asset][fromState][toState][sender] = true;
            if (states[toState].strategy == Strategy.STRATEGY_ALL) {
                return currentInvocations == invocations;
            } else {
                return currentInvocations * 2 > invocations;
            }
        } else {
            // for STRATEGY_ANY
            return true;
        }

    }

    /**
     * @notice Determine a the transition.
     * @return bool true if the state can change, false if not.
     *          This reverts if invalid.
     */
    function _canTransition(uint256 asset, bytes32 fromState, bytes32 toState)
        private
        returns (bool)
    {
        return _checkAllTransitionCriteria(msg.sender, asset, fromState, toState);
    }

    function _emitEvent(uint256 asset, bytes32 fromState, bytes32 toState, bool can)
        private
    {
        if(can) {
            emit Transition(msg.sender, asset, fromState, toState);
        } else {
            emit Transition(msg.sender, asset, fromState, fromState);
        }
    }

    /**
     * @dev Function to perform a transition or confirmation of the state of an asset.
     */
    function transition(uint256 asset, bytes32 toState) internal nonReentrant {
        require(assetExists(asset), "SIMBA-CODE: 4001");
        bytes32 fromState = getStateFromStorage(asset);
        bool can = _canTransition(asset, fromState, toState);
        if (can) {
            setStateToStorage(asset, toState);
        }
        _emitEvent(asset, fromState, toState, can);
    }

    /**
     * @dev Function to initialize the state of an asset.
     */
    function initAsset(uint256 asset, bytes32 state) internal {
        require(
            states[state].exists,
            "SIMBA-CODE: 4003"
        );
        require(
            getStateFromStorage(asset) == 0,
            "SIMBA-CODE: 4004"
        );
        setStateToStorage(asset, state);
    }

    /**
     * @dev Utility function to get the state of an asset as a string.
     */
    function getAssetState(uint256 asset) public view returns (string memory) {
        return string(abi.encodePacked(getStateFromStorage(asset)));
    }

    /**
     * @dev Abstract function to setup te state machine configuration.
     */
    function setupStateMachine() internal virtual {
        _status = _NOT_TRANSITIONING;
    }

    /**
     * @dev Abstract function to check asset exists.
     */
    function assetExists(uint256 asset) internal view virtual returns (bool);

    /**
     * @dev Abstract function to get the current state of an asset.
     */
    function getStateFromStorage(uint256 asset) internal view virtual returns (bytes32);

    /**
     * @dev Abstract function to set the current state of an asset.
     */
    function setStateToStorage(uint256 asset, bytes32 state) internal virtual;

}