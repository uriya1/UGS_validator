---
stepsCompleted: [1, 2]
inputDocuments: []
date: 2026-02-09
author: UGS Master
---

# Product Brief: UGS_validator

## Executive Summary

UGS_validator is a validation tool designed to prevent configuration failures in Unity Gaming Services (UGS) by catching JEXL syntax errors and intent mismatches before they reach production. The tool addresses a critical pain point where configurators attempting to create A/B tests via UGS game overrides or set up remote configurations fail due to invalid JEXL syntax or configurations that don't match their intended behavior.

The solution combines comprehensive JEXL syntax validation with UGS/Wisdom-specific parameter knowledge and intent verification, providing real-time feedback that helps developers, QA teams, and data analysts catch errors early in the configuration process. By preventing production issues and improving developer experience, UGS_validator reduces debugging time, prevents broken A/B tests from going live, and ensures remote configurations work as intended.

---

## Core Vision

### Problem Statement

Configurators working with Unity Gaming Services face significant challenges when creating A/B tests through UGS game overrides or setting up remote configurations. The current workflow lacks robust validation, leading to two primary failure modes:

1. **Invalid JEXL Syntax**: Configurators write JEXL expressions that fail due to syntax errors, parameter name mistakes, or incorrect expression structure. These errors only surface when the configuration is deployed or tested, causing delays and requiring time-consuming debugging.

2. **Intent Mismatches**: Even when JEXL syntax is technically valid, the configuration may not behave as the creator intended. The setup might reference incorrect parameters, use wrong comparison operators, or fail to match the logical conditions the A/B test or remote config was meant to implement.

### Problem Impact

When configuration failures occur, the impact is felt across multiple stakeholders:

- **Configurators** waste time debugging syntax errors and intent mismatches
- **Developers** face production incidents from broken A/B tests or incorrect remote configs
- **QA teams** discover configuration issues late in the testing cycle
- **Data analysts** receive incorrect data from failed A/B tests
- **End users** experience issues from misconfigured remote settings

The problem escalates when invalid configurations reach production, potentially affecting user experience, data integrity, and business metrics. Current solutions rely on manual code review, trial-and-error testing, or discovering issues only after deployment—all inefficient and error-prone approaches.

### Why Existing Solutions Fall Short

Current approaches to JEXL validation have significant limitations:

- **Generic JEXL Validators**: While basic JEXL syntax checkers exist, they lack knowledge of UGS/Wisdom-specific parameters, making them unable to validate parameter names, types, or UGS-specific expression patterns.

- **Manual Review**: Code review processes are time-consuming, inconsistent, and don't scale with the volume of configurations being created.

- **Post-Deployment Discovery**: Finding configuration errors after deployment leads to production incidents, user impact, and costly rollbacks.

- **No Intent Verification**: Existing tools validate syntax but cannot verify that the configuration logic matches the creator's intent or follows best practices for A/B testing and remote configuration.

### Proposed Solution

UGS_validator provides comprehensive validation for JEXL expressions used in UGS configurations, combining:

1. **Syntax Validation**: Real-time JEXL syntax checking that catches errors before configuration submission, with clear, actionable error messages.

2. **Parameter Validation**: UGS/Wisdom-aware validation that verifies parameter names against known schemas (user-level, app-level, Unity-level parameters), ensuring only valid parameters are referenced.

3. **Intent Verification**: Logic validation that checks whether the configuration matches common patterns and best practices, helping catch logical errors even when syntax is valid.

4. **Developer Experience**: Integrated workflow that provides immediate feedback, suggestions for common mistakes, and guidance on proper JEXL expression construction.

The tool leverages comprehensive knowledge of UGS and Wisdom platform parameters (as documented in parameter reference sheets) to provide context-aware validation that generic tools cannot offer.

### Key Differentiators

UGS_validator's competitive advantage comes from several unique capabilities:

- **UGS/Wisdom-Specific Knowledge**: Deep integration with UGS parameter schemas, understanding of platform-specific expression patterns, and knowledge of common configuration use cases.

- **Intent Verification**: Goes beyond syntax checking to validate that configurations match intended behavior, catching logical errors that pure syntax validators miss.

- **Comprehensive Parameter Reference**: Built-in knowledge base of all valid UGS/Wisdom parameters, their types, valid values, and usage patterns—making it impossible for generic validators to replicate.

- **Developer-Centric Design**: Focus on preventing production issues and improving developer experience through real-time feedback, clear error messages, and actionable suggestions.

- **Integration-Ready**: Designed to fit seamlessly into the UGS configuration workflow, providing validation at the point of creation rather than requiring separate validation steps.
