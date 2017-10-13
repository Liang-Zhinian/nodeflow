'use strict';

var LISTENER_START = 'start';
var LISTENER_END = 'end';
var LISTENER_TAKE = 'take';
var LISTENER_ERROR = 'error';

var getActivitiesByType = function (activityDefinition, type, recursive) {
    var baseElements = [];
    if (!activityDefinition || !activityDefinition.baseElements) {
        return baseElements;
    }

    for (var i = 0; i < activityDefinition.baseElements.length; i++) {
        var childActivity = activityDefinition.baseElements[i];
        if (!!childActivity.type && childActivity.type == type) {
            baseElements.push(childActivity);
            if (recursive) {
                baseElements = baseElements.concat(getActivitiesByType(childActivity, type, recursive));
            }
        }
    }
    return baseElements;
};

var getActivityById = function (activityDefinition, id) {
    if (!activityDefinition || !activityDefinition.baseElements) {
        return null;
    }

    for (var i = 0; i < activityDefinition.baseElements.length; i++) {
        var childActivity = activityDefinition.baseElements[i];
        if (!!childActivity.id && childActivity.id == id) {
            return childActivity;
        }
    }
    return null;
};

var getSequenceFlows = function (activityDefinition, scopeActivity) {
    var result = [];
    if (!activityDefinition || !scopeActivity) {
        return result;
    }

    if (!!activityDefinition.outgoing) {
        var outgoingSequenceFlowIds = activityDefinition.outgoing;
        for (var i = 0; i < outgoingSequenceFlowIds.length; i++) {
            var sequenceFlowId = outgoingSequenceFlowIds[i];
            result.push(getActivityById(scopeActivity, sequenceFlowId));
        }
    }

    return result;
};

var VariableScope = (function () {

    function VariableScope(activityExecution) {
        activityExecution.bindVariableScope(this);
    }

    VariableScope.prototype.evaluateCondition = function (condition) {
        return eval(condition);
    };

    return VariableScope;
})();

function evaluateCondition(condition, activityExecution) {
    return new VariableScope(activityExecution).evaluateCondition(condition);
}

// the default outgoing behavior for BPMN 2.0 activities //////////

function leave(activityExecution, callback) {

    // SEPC p.427 ??13.2.1
    // Multiple outgoing Sequence Flows behaves as a parallel split.
    // Multiple outgoing Sequence Flows with conditions behaves as an inclusive split.
    // A mix of multiple outgoing Sequence Flows with and without conditions is considered as a combination of a parallel and an inclusive split

    var sequenceFlowsToTake = [];
    var availableSequenceFlows = getSequenceFlows(activityExecution.activityDefinition, activityExecution.parentExecution.activityDefinition);
    var defaultFlowId = activityExecution.activityDefinition['default'];

    var defaultFlow = null;
    var noConditionalFlowActivated = true;

    for (var i = 0; i < availableSequenceFlows.length; i++) {
        var sequenceFlow = availableSequenceFlows[i];

        if (!!defaultFlowId && defaultFlowId == sequenceFlow.id) {
            defaultFlow = sequenceFlow;
        } else if (!sequenceFlow.condition) {
            sequenceFlowsToTake.push(sequenceFlow);
        } else if (evaluateCondition(sequenceFlow.condition, activityExecution)) {
            sequenceFlowsToTake.push(sequenceFlow);
            noConditionalFlowActivated = false;
        }
    }

    // the default flow is only activated if all conditional flows are false
    if (noConditionalFlowActivated && !!defaultFlow) {
        sequenceFlowsToTake.push(defaultFlow);
    }

    activityExecution.takeAll(sequenceFlowsToTake);
}

exports.getActivitiesByType = getActivitiesByType;
exports.getActivityById = getActivityById;
// exports.getActivityType = getActivityType;
exports.getSequenceFlows = getSequenceFlows;
exports.leave = leave;
exports.evaluateCondition = evaluateCondition;

exports.LISTENER_START = LISTENER_START;
exports.LISTENER_END = LISTENER_END;
exports.LISTENER_TAKE = LISTENER_TAKE;
exports.LISTENER_ERROR = LISTENER_ERROR;

exports.eventNames = [LISTENER_END, LISTENER_START, LISTENER_TAKE, LISTENER_ERROR];
