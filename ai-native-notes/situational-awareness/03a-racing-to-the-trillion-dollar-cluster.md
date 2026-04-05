---
title: "IIIa. Racing to the Trillion-Dollar Cluster"
source: https://situational-awareness.ai/racing-to-the-trillion-dollar-cluster/
author: Leopold Aschenbrenner
date_published: 2024-06
date_captured: 2026-04-05
content_type: essay
series: "Situational Awareness: The Decade Ahead"
chapter: 3a
---

# IIIa. Racing to the Trillion-Dollar Cluster

**The most extraordinary satisfying techno-capital acceleration has been put into motion. By the end of the decade, we will be building trillion-dollar compute clusters with power demands rivaling small nations. The industrial mobilization required will be staggering, but it is feasible -- and the economic incentives to make it happen are overwhelming.**

> Note: Pages 75-85 covering training compute scaling, overall compute investment tables, AI revenue projections, historical precedents, and power constraints were captured in a prior session. This file covers the remaining sections on chips and industrial mobilization (pages 86-88).

## Chips: The Near-Term Bottleneck

By 2030, the demand for AI chips (for both training and inference across multiple players) will be a multiple of TSMC's current total leading-edge logic chip capacity. TSMC has roughly doubled its capacity in the past 5 years (using revenue as a proxy), but would need to go at least twice as fast on expansion to meet projected AI chip demand. Massive new fab investments are necessary.

### Advanced Packaging and Memory Constraints

Even if raw logic fab capacity is not the binding constraint, two other bottlenecks are critical:

- **CoWoS (Chip-on-Wafer-on-Substrate)**: Advanced packaging connecting chips to memory, made by TSMC, Intel, and others. Already a key bottleneck for AI GPU scaleup. More specialized to AI than pure logic chips, with less pre-existing capacity. TSMC is building entirely new "greenfield" fabs to massively scale up CoWoS production, and Nvidia is finding alternatives to work around the shortage.
- **HBM (High Bandwidth Memory)**: Demand is enormous and this is another major constraint.

These will be the primary near-term constraints on GPU production, and the huge constraints as AI scales. Still, they are comparatively "easy" to scale compared to fundamental physics limits.

### TSMC Fab Economics

- A new TSMC Gigafab costs around **$20B in capex** and produces **100k wafer-starts per month**
- For hundreds of millions of AI GPUs per year by end of decade, TSMC would need to build **dozens** of new Gigafabs
- Additionally requires huge buildout for memory, advanced packaging, networking, etc.
- Total could add up to over **$1T of capex** -- intense, but doable
- Biggest roadblock may not be feasibility but TSMC's mindset: they assume AI will "only" grow at a 50% CAGR, suggesting they are not yet "AI-scaling-pilled"

### CHIPS Act and Onshoring

Recent USG efforts like the CHIPS Act aim to onshore more AI chip production to the US as insurance against a Taiwan contingency. However, the author argues:

- **Onshoring chips is less critical than onshoring datacenters**: If having chip production abroad is like having uranium deposits abroad, having the AGI datacenter abroad is like having the literal nukes built and stored abroad
- Given the dysfunction and cost of building fabs in the US in practice, it may be better to prioritize datacenters in the US while leveraging democratic allies like Japan and South Korea for fab buildouts, where construction seems much more functional

## The Clusters of Democracy

Before the decade is out, many trillions of dollars of compute clusters will have been built. The key question is whether they will be built in America or elsewhere.

### The National Security Imperative

- Some clusters are rumored to be planned for the Middle East, raising serious concerns about building AGI infrastructure under the control of capricious dictatorships
- The clusters being planned today may well become the clusters AGI and superintelligence are trained and run on -- not just "cool-big-tech-product clusters"
- Building clusters abroad creates irreversible security risks:
  - Model weights could be stolen (side-channel attacks are easier with physical access)
  - Dictatorships could physically seize datacenters when the AGI race heats up
  - Even implicit threats put AGI at unsavory dictators' whims
- America's energy dependence on the Middle East in the 1970s is a cautionary precedent

### The Deregulatory Imperative

The clusters can be built in the US, but it requires getting our act together:
- American national security must come first, before the allure of Middle Eastern cash, arcane regulation, or climate commitments
- Being willing to use natural gas, or at the very least pursuing a broad deregulatory agenda: NEPA exemptions, fixing FERC and transmission permitting at the federal level, overriding utility regulation, using federal authorities to unlock land and rights of way
- This is a **national security priority**

## Conclusion

The exponential is in full swing. In the "old days," Aschenbrenner and colleagues used to make theoretical economic models of the path to AGI, featuring a hypothetical "AI wakeup" moment when the world realized how powerful these models could be and began rapidly ramping up investments. That moment arrived in 2023. Behind the scenes, the most staggering techno-capital acceleration has been put into motion. Brace for the G-forces.

The investment implications are significant: those with situational awareness bought into key stocks like NVDA and TSM much lower, but it is still not even close to fully priced in. Mainstream sell-side analysts were assuming only 10-20% year-over-year growth in Nvidia revenue, perhaps $120-130B in CY25, when it was already clear Nvidia would do over $200B in CY25 revenue.
