import {assignmentString} from "./monitor_generator.js";
import {convertMapping} from "./monitor_generator.js";

const REQUIRED_KEYS = ["title", "description", "template_variables", "layout_type", "is_read_only", "notify_list", "id"];
const VALID_SLO_KEYS = ["view_type", "slo_id", "show_error_budget", "view_mode", "time_windows", "title", "title_size", "title_align"];
const INDENT = "  ";

export function generateDashboardTerraformCode(resourceName, dashboardJson) {
    if (!resourceName) {
        resourceName = "dashboard"
    }
    if (!dashboardJson) {
        throw "You're missing a required key.";
    }
    return `resource "datadog_dashboard" "${resourceName}" {${dashboardBody(dashboardJson)}}`;
}

function dashboardBody(dashboardJson) {
    let result = "\n";

    Object.entries(dashboardJson).forEach(([key, value]) => {
        result += convert(INDENT, key, value);
    });

    return result;
}

function convert(indent, key, value) {
    let result = "";
    if (REQUIRED_KEYS.includes(key)) {
        if (key === "id") return result;
        if (key === "template_variables") {
            return result + convertTemplateVariables(indent, value);
        }
        result += indent + assignmentString(key, value);
    } else if (key === "widgets") {
        result += convertWidgets(indent, value);
    } else {
        throw `Conversion for "${key}" not found`;
    }
    return result;
}

function convertTemplateVariables(indent, templateVariables) {
    let result = "";
    for (let templateVariable of templateVariables) {
        result += `${indent}template_variable {\n`;

        Object.entries(templateVariable).forEach(([key, value]) => {
            result += indent + INDENT + assignmentString(key, value);
        });
        result += `${indent}}\n`;
    }
    return result;
}

function convertWidgets(indent, widgets) {
    let result = "";
    for (let widget of widgets) {
        result += `${indent}widget {\n`;

        Object.entries(widget).forEach(([key, value]) => {
            if (key === "definition") {
                result += constructWidgetDefinition(indent + INDENT, value);
            } else if (key === "layout") {
                result += convertNestedMappings(indent + INDENT, key, value, true);
            }
        });
        result += `${indent}}\n`;
    }
    return result;
}

function constructWidgetDefinition(indent, definition) {
    let result = "";
    if (definition["type"] === "slo") {
        result += indent + "service_level_objective_definition {\n";
    } else {
        result += indent + definition["type"] + "_definition {\n";
    }
    Object.entries(definition).forEach(([key, value]) => {
        if (key === "type" || (definition["type"] === "slo" && !VALID_SLO_KEYS.includes(key))) {
            return;
        }
        if (key === "time") {
            result += convertNestedMappings(indent + INDENT, key, value), true;
        } else if (key === "yaxis") {
            result += convertNestedMappings(indent + INDENT, key, value), false;
        } else if (key === "widgets") {
            result += convertWidgets(indent + INDENT, value);
        } else if (key === "requests") {
            result += convertRequests(indent + INDENT, value);
        } else if (key === "markers"){
            result += convertMarkers(value);
        } else if (key === "custom_links"){
            // Not supported by terraform yet.
        } else {
            result += indent + INDENT + assignmentString(key, value);
        }
    });
    return `${result}${indent}}\n`;
}

function convertRequests(indent, requests) {
    let result = "";
    for (let request of requests) {
        let requestBody = "\n";
        Object.entries(request).forEach(([key, value]) => {
            if (key === "style") {
                requestBody += convertNestedMappings(indent + INDENT, key, value, false);
            } else if (key === "conditional_formats") {
                requestBody += convertConditionalFormats(indent + INDENT, value);
            } else {
                requestBody += indent + INDENT + assignmentString(key, value);
            }

        });
        result += `${indent}request {${requestBody}${indent}}\n`
    }
    return result;
}

function convertConditionalFormats(indent, conditionalFormats) {
    let result = "";
    for (let conditionalFormat of conditionalFormats) {
        result += `${indent}conditional_formats {\n`;

        Object.entries(conditionalFormat).forEach(([key, value]) => {
            result += indent + INDENT + assignmentString(key, value);
        });
        result += `${indent}}\n`;
    }
    return result;
}

function convertNestedMappings(indent, mappingName, mapping, is_arg) {
    let result = "";

    let sign = " "
    if (is_arg) {
        sign = " = ";
    }
    Object.entries(mapping).forEach(([key, value]) => {
        result += indent + INDENT + assignmentString(key, value);
    });
    return `${indent}${mappingName}${sign}{\n${result}${indent}}\n`;
}

function convertMarkers(markers) {
    let result = "\n";
    for (let marker of markers) {
        let markerBody = "\n";
        Object.entries(marker).forEach(([key, value]) => {
            markerBody += assignmentString(key, value);
        });
        result += `marker {${markerBody}}`
    }
    return result;
}