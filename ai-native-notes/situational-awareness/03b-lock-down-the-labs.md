---
title: "IIIb. Lock Down the Labs: Security for AGI"
source: https://situational-awareness.ai/lock-down-the-labs/
author: Leopold Aschenbrenner
date_published: 2024-06
date_captured: 2026-04-05
content_type: essay
series: "Situational Awareness: The Decade Ahead"
chapter: 3b
---

# IIIb. Lock Down the Labs: Security for AGI

**The nation's leading AI labs treat security as an afterthought. Currently, they're basically handing the key secrets for AGI to the CCP on a silver platter. Securing the AGI secrets and weights against the state-actor threat will be an immense effort, and we're not on track.**

The chapter opens with a parallel to the atomic bomb era: Szilard, Teller, and Bohr debated in 1939 whether to keep fission research secret, lest the Nazis learn of it. Bohr initially insisted secrecy must never be introduced into physics. History proved otherwise.

## The Stakes

On the current course, the leading Chinese AGI labs will not be in Beijing or Shanghai -- they will be in San Francisco and London. In a few years, AGI secrets will clearly be the United States' most important national defense secrets, deserving treatment on par with B-21 bomber or Columbia-class submarine blueprints. Yet today, they are treated like random SaaS software. At this rate, we are basically just handing superintelligence to the CCP.

All the trillions invested, the mobilization of American industrial might, the efforts of our brightest minds -- none of it matters if China or others can simply steal the model **weights** (a large file on a computer) or key **algorithmic secrets** (the technical breakthroughs necessary to build AGI).

## The Current Failure

America's leading AI labs self-proclaim to be building AGI and believe the technology they are building will be the most powerful weapon America has ever built. But they do not treat it as such:

- They measure security against "random tech startups," not "key national defense projects"
- Labs are barely able to defend against scriptkiddies, let alone "North Korea-proof security," let alone the Chinese Ministry of State Security at full force
- The failure today will be irreversible soon: **in the next 12-24 months, key AGI breakthroughs will leak to the CCP**
- This will be the national security establishment's single greatest regret before the decade is out

The preservation of the free world against authoritarian states is on the line, and a healthy lead is the necessary buffer that gives margin to get AI safety right too.

## Underrate State Actors at Your Peril

The capabilities of nation-states and their intelligence agencies are extremely formidable. Even in normal times, they have been able to:

- Zero-click hack any iPhone and Mac with just a phone number
- Infiltrate an airgapped atomic weapons program (Stuxnet)
- Modify Google source code
- Find dozens of zero-days a year that take on average 7 years to detect
- Spearphish major tech companies
- Install keyloggers on employee devices
- Insert trapdoors in encryption schemes
- Steal information via electromagnetic emanations or vibration
- Use just the noise from a computer to determine location or steal passwords
- Gain direct access to nuclear power plants
- Exfiltrate 22 million security clearance files from the USG
- Expose financial information of 110 million customers via HVAC vulnerabilities
- Compromise computer hardware supply chains at large scale
- Slip malicious code into software dependencies used by top tech companies and the USG
- Plant spies, seduce/cajole/threaten employees at large scales
- Execute special forces operations

Already, China engages in widespread industrial espionage; the FBI director stated the PRC has a hacking operation greater than "every major nation combined." A Chinese national was arrested for stealing key AI code from Google back in 2022/23. Once adversaries "wake up to AGI," AI will become the #1 priority of every intelligence agency, and they will employ extraordinary means and pay any cost to infiltrate the AI labs.

## The Threat Model

### Model Weights

An AI model is just a large file of numbers on a server that can be stolen. All it takes an adversary to match your trillions of dollars and decades of work is to steal this file. (Imagine if the Nazis had gotten an exact duplicate of every atomic bomb made in Los Alamos.)

- If we cannot keep model weights secure, we are just building AGI for the CCP (and given current security, even North Korea)
- Securing model weights is critical for preventing AI catastrophes too -- if terrorists or rogue states can steal models and circumvent safety layers, whatever novel WMDs superintelligence could invent would rapidly proliferate
- Security is also the first line of defense against uncontrolled or misaligned AI systems

**The nightmare scenario**: China steals the automated-AI-researcher model weights on the cusp of an intelligence explosion. They could immediately automate AI research themselves and launch their own intelligence explosion, even if they had previously been way behind. Any US lead would vanish, and we would be in an existential race with no margin for safety.

### Current Security is Woefully Inadequate

Google DeepMind (perhaps the lab with the best security given Google infrastructure) admits being at **security level 0** (only the most banal and basic measures) in their Frontier Safety Framework, which outlines levels 0 through 4:
- Level ~1.5: Defense against well-resourced terrorist groups or cybercriminals
- Level 3: Defense against North Korea-tier threats
- Level 4: Any shot at defending against priority efforts by the most capable state actors

Developing the infrastructure for weight security takes many years of lead time. If AGI is ~3-4 years away and we need state-proof weight security, the crash effort needs to launch **now**. Securing weights will require innovations in hardware and radically different cluster design.

### Algorithmic Secrets

Arguably even more important right now -- and vastly underrated -- is securing algorithmic secrets. Stealing algorithmic secrets is equivalent to having a 10x or 100x larger cluster:

- Algorithmic progress is roughly as important as scaling compute to AI progress (~0.5 OOMs of compute efficiency per year, plus additional "unhobbling" gains)
- Multiple OOMs-worth of algorithmic secrets exist between now and AGI
- The US is spending 100s of billions on export controls for Nvidia chips (perhaps a 3x increase in compute cost for Chinese labs) -- but **leaking 3x algorithmic secrets all over the place**
- The key paradigm breakthroughs for AGI (the "AlphaGo self-play"-equivalent for general intelligence) are being developed right now. Without better security in the next 12-24 months, we may irreversibly supply China with these key breakthroughs

The importance of an algorithmic edge is easy to underrate because until recently, everything was published. But labs have stopped publishing their advances, and we should expect far more divergence ahead. A few American labs will be way ahead -- a moat worth 10x, 100x, or more -- unless they instantly leak the algorithmic secrets.

**Failing to protect algorithmic secrets is probably the most likely way China stays competitive in the AGI race.**

### Current State of Algorithmic Security

It is hard to overstate how bad it is:
- Between the labs, thousands of people have access to the most important secrets
- Basically no background-checking, silo'ing, controls, or basic infosec
- Things are stored on easily hackable SaaS services
- People gabber at parties in SF
- Anyone could be offered $100M and recruited to a Chinese lab at any point
- ByteDance reportedly emailed basically every person on the Google Gemini paper, offering them L8 positions

Marc Andreessen's assessment: "My own assumption is that all such American AI labs are fully penetrated and that China is getting nightly downloads of all American AI research and code RIGHT NOW..."

### Defending Algorithmic Secrets is Feasible

While tough, only dozens of people truly "need to know" the key implementation details for a given algorithmic breakthrough at a given lab. You can vet, silo, and intensively monitor these people, in addition to radically upgraded infosec.

## What "Supersecurity" Will Require

Low-hanging fruit would help against normal economic espionage (adopting best practices from secretive hedge funds like Jane Street, or Google-customer-data-level security). But once China brings the full force of espionage to bear, **this will only be possible with government help**:

- Microsoft is regularly hacked by state actors (Russian hackers stole Microsoft executives' emails; government emails Microsoft hosts)
- A high-level security expert estimated that even with a complete private crash course, China would still likely be able to exfiltrate AGI weights if it was their #1 priority
- Only the government has the infrastructure, know-how, and competencies to protect national-defense-level secrets

### State-Actor-Proof Security Would Require:

- Fully airgapped datacenters with physical security on par with military bases (cleared personnel, physical fortifications, onsite response team, extensive surveillance, extreme access control) -- for both training AND inference clusters
- Novel technical advances on confidential compute / hardware encryption and extreme scrutiny on entire hardware supply chain
- All research personnel working from a SCIF (Sensitive Compartmented Information Facility)
- Extreme personnel vetting and security clearances, regular integrity testing, constant monitoring, substantially reduced freedoms to leave, rigid information siloing
- Strong internal controls (e.g., multi-key signoff to run any code)
- Strict limitations on external dependencies, satisfying TS/SCI network requirements
- Ongoing intense pen-testing by the NSA or similar

## Objections to Strict Security

### "It would slow down the labs too much"

- This is a **tragedy of the commons** problem: for any given lab, a 10% slowdown is deleterious against competitors, but the national interest is clearly better served if every lab accepts the friction (America retaining 90% algorithmic progress is clearly better than retaining 0%)
- Ramping security now will be the **less painful** path in the long run -- eventually the USG will demand a security crackdown, and implementing it from a standing start will be far more disruptive

### "We'll stay ahead anyway"

- The CCP may well be able to brutely outbuild the US (a 100GW cluster will be much easier for them)
- China might not have the same caution slowing it down
- Even if the US squeaks out ahead, the difference between a 1-2 year and 1-2 month lead **really matters** for navigating the perils of superintelligence and the intelligence explosion
- Don't forget Russia, Iran, North Korea -- their hacking capabilities are no slouch, and we are freely sharing superintelligence with them too

## We Are Not on Track

The chapter draws a parallel to Leo Szilard's efforts to impose secrecy on fission research in 1939-1940. Most scientists initially rebuffed him, but it was slowly accepted that the military potential was too great to simply share with the Nazis. Secrecy was finally imposed just in time.

A critical historical detail: In the fall of 1940, Fermi kept his graphite absorption measurements secret. At the same time, the German project's Walther Bothe made an incorrect measurement at Heidelberg, concluding graphite would not work as a moderator. Since Fermi had kept his result secret, the Germans could not cross-check, and pursued heavy water instead -- **a decisive wrong path that ultimately doomed the German nuclear weapons effort**.

### The Mental Dissonance at AI Labs

- Labs full-throatedly claim to be building AGI this decade
- They emphasize American leadership on AGI will be decisive for national security
- They are reportedly planning $7T chip buildouts
- When you bring up security, they nod and smirk: "of course, we'll all be in a bunker"
- Yet whenever hard choices come, startup attitudes and commercial interests prevail over national interest
- The national security advisor would have a mental breakdown if he understood the level of security at the nation's leading AI labs

The reality: (a) in the next 12-24 months, we will develop the key algorithmic breakthroughs for AGI and promptly leak them to the CCP, and (b) we are not even on track for our weights to be secure against rogue actors like North Korea, let alone an all-out effort by China, by the time we build AGI.

We are developing the most powerful weapon mankind has ever created. The algorithmic secrets we are developing right now are literally the nation's most important national defense secrets -- the secrets that will determine the outcome of WWIII, the secrets that will determine the future of the free world. And yet AI lab security is probably worse than a random defense contractor making bolts.

**Basically nothing else we do -- on national competition, and on AI safety -- will matter if we don't fix this, soon.**
