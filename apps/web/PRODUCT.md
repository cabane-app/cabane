# Cabane web product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Home Assistant users build a representation of their home and associate its objects with their own controls and sensors.

## Product Purpose

Cabane combines a 3D home with a Home Assistant dashboard. Construct authors the architecture, Arrange places objects, and Connect associates rooms and object functions with Home Assistant sources.

## Operating Context

The editor runs as a standalone web application and in Home Assistant. Connect must support large entity registries, multiple functions per object, optional independent readings, and devices outside architectural rooms.

## Capabilities and Constraints

Product behavior is authoritative in [PRODUCT_SPEC](../../PRODUCT_SPEC.md) and [product contracts](../../docs/product/). Mapping stages ordinary undoable workspace changes and never sends a physical device command. Scene display, mapping, availability and dashboard visibility are separate states. Saved projects and private household mappings must retain their identities.

## Brand Commitments

Keep the English UI, Cabane identity, existing typography and palette, and Construct, Arrange and Connect modes. The approved Connect direction is Option A: room selection on the plan, then a device rail, connection summary and source picker across the workspace. Properties provides direct connection actions and explicit model-display controls.

## Evidence on Hand

The user approved the Option A interactive layout on 30 October 2026. Use synthetic data for previews and tests. Household identifiers, credentials and screenshots do not belong in Git.

Construct and Arrange on phones use the full-screen panel direction approved on 30 October 2026. Panels open from a compact dock on demand, and the catalog uses category cards on desktop and mobile.

## Product Principles

- Show the object's function and its selected source, rather than exposing binding internals.
- Search the entire eligible source list, with direct type filters and suggestions first.
- Make connection, availability and display state independently understandable.
- Reveal configuration after the user chooses the corresponding action.
