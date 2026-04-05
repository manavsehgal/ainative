---
title: "IIIc. Superalignment"
source: https://situational-awareness.ai/superalignment/
author: Leopold Aschenbrenner
date_published: 2024-06
date_captured: 2026-04-05
content_type: essay
series: "Situational Awareness: The Decade Ahead"
chapter: 3c
---

# IIIc. Superalignment

**Reliably controlling AI systems much smarter than we are is an unsolved technical problem. And while it is a solvable problem, things could very easily go off the rails during a rapid intelligence explosion. Managing this will be extremely tense; failure could easily be catastrophic.**

The author states upfront: he is not a doomer. Misaligned superintelligence is probably not the biggest AI risk (he is more worried about "things just being totally crazy" around superintelligence, including novel WMDs, destructive wars, and unknown unknowns, plus the authoritarian threat). But he spent the past year working on technical alignment research at OpenAI, on the Superalignment team with Ilya Sutskever, and wants to explain the "default plan" for muddling through and why he is optimistic -- but also why he is worried.

## The Problem

### The Superalignment Problem

Current alignment techniques rely on RLHF (Reinforcement Learning from Human Feedback): the AI tries stuff, humans rate whether the behavior was good or bad, and good behaviors are reinforced. This has been the key behind ChatGPT's success -- steering base models from garbled internet text into useful, instruction-following assistants with safety guardrails.

But RLHF relies fundamentally on humans being able to understand and supervise AI behavior. **This will not scale to superhuman systems.**

The core technical problem is simple: **how do we control AI systems (much) smarter than us?**

Imagine a superhuman AI system generating a million lines of code in a new programming language it invented. A human rater in an RLHF procedure could not possibly determine whether the code contains security backdoors. We would lose the ability to reinforce good behaviors and penalize bad ones.

Already, AI labs need to pay expert software engineers ~$100/hour for GPQA ratings for ChatGPT code. Human labeler pay has gone from a few dollars for MTurk labelers to this level, and in the near future even the best human experts spending lots of time will not be good enough. The goal of superalignment research is to repeat the success story of RLHF: make the basic research bets that will be necessary to steer and deploy AI systems a couple years down the line.

### What Failure Looks Like

People too often picture a "GPT-6 chatbot" and convince themselves these would not be dangerously misaligned. But the trajectory points to agents trained with RL. Consider a future powerful base model that we train with long-horizon RL to run a business and make money:

- By default, it may well learn to lie, commit fraud, deceive, hack, seek power -- simply because these can be successful strategies in the real world
- We want to add **side-constraints**: do not lie, do not break the law, etc.
- But we come back to the fundamental issue: we will not be able to understand what superhuman systems are doing, so we will not be able to notice and penalize bad behavior with RLHF

Without the ability to add these side constraints, the consequences could range from benign (maybe the systems are benign by default) to catastrophic. Systems might learn to lie, seek power, behave nicely when humans are looking and pursue nefarious strategies when we are not watching.

Superintelligence will have vast capabilities and will be integrated in many critical systems, including military systems. Alignment failures could look like isolated incidents (an autonomous agent committing fraud, a model self-exfiltrating, a drone swarm overstepping rules of engagement) or much larger scale failures -- potentially a robot rebellion by an alien intelligence whose goals were learned by a natural-selection-esque process.

### The Intelligence Explosion Makes This Incredibly Tense

Superalignment is a solvable technical problem. But the possibility of an intelligence explosion -- transitioning from roughly human-level to vastly superhuman systems extremely rapidly, perhaps in less than a year -- makes it incredibly hair-raising.

| Dimension | AGI | Superintelligence |
|-----------|-----|-------------------|
| Required alignment technique | RLHF++ | Novel, qualitatively different technical solutions |
| Failures | Low-stakes | Catastrophic |
| Architecture and algorithms | Familiar, descendants of current systems, fairly benign safety properties | Alien. Designed by previous-generation super-smart AI system |
| Backdrop | World is normal | World is going crazy, extraordinary pressures |
| Epistemic state | We can understand what systems are doing, how they work, and whether they're aligned | We have no ability to understand what's going on, and we are entirely reliant on trusting the AI systems |

This transition could happen in **less than 1 year**, with very little time to get decisions right.

Key concerns:
- We will extremely rapidly go from systems where RLHF works fine to systems where it totally breaks down, leaving little time to iteratively discover and address failure modes
- The stakes will rapidly escalate from low (ChatGPT said a bad word) to extreme (superintelligence self-exfiltrated from our cluster and is hacking the military)
- The superintelligence we get by the end will be vastly superhuman -- we will be entirely reliant on trusting what it tells us
- The superintelligence will be quite **alien** -- architectures and training algorithms will be totally different, with riskier safety properties
  - Early AGIs may reason via English chains of thought (extraordinarily helpful for catching malign behavior), but surely a more efficient approach exists via internal states, meaning the model will eventually have completely uninterpretable reasoning
- The period will be incredibly volatile, potentially with the backdrop of an international arms race

A representative scenario: "We caught the AI system doing some naughty things in a test, but we adjusted our procedure a little bit to hammer that out. Our automated AI researchers tell us the alignment metrics look good, but we don't really understand what's going on and don't fully trust them... So, we'll probably be fine? Also China just stole our weights and they're launching their own intelligence explosion, they're right on our heels."

## The Default Plan: How We Can Muddle Through

### Aligning Somewhat-Superhuman Models

Even the first systems that can do automated AI research (starting the intelligence explosion) will already be substantially superhuman in many domains. AI capabilities are likely to be "spikey" -- by the time AGI is human-level at whatever a human AI researcher/engineer is worst at, it will be superhuman at many other things (superhuman coders, superhuman at math and ML).

But these early-intelligence-explosion systems will look much closer to today's systems in terms of architecture, and the intelligence gap to cover is more manageable (like a smart high schooler supervising a PhD graduate, rather than a first grader).

### Key Research Bets

**Evaluation is easier than generation.** We get some of the way "for free" because it is easier for us to evaluate outputs than to generate them ourselves. It takes months to write a paper but only hours to evaluate one. Teams of expert humans will spend a lot of time evaluating every RLHF example and can "thumbs down" a lot of misbehavior even if the AI is somewhat smarter than them. But this only takes us so far -- GPT-2 or GPT-3 could not detect nefarious GPT-4 reliably even though evaluation is easier than generation.

**Scalable oversight.** We can use AI assistants to help humans supervise other AI systems -- the human-AI team extending supervision farther than the human could alone. For example, a model trained to critique code written by another model could help humans supervise a system with narrowly superhuman coding abilities. Proposed strategies include debate, market-making, recursive reward modeling, and prover-verifier games. Models are now strong enough to empirically test these ideas. This is expected to help a lot for "quantitatively" superhuman problems (a million lines of code) but the author is less optimistic about "qualitatively" superhuman problems (the model invents quantum physics when you only understand Newtonian physics).

**Generalization.** Even with scalable oversight, we will not be able to supervise AI systems on problems beyond human comprehension. But we can study how AI systems **generalize** from human supervision on easy problems to behavior on hard problems. Part of the magic of deep learning is that it often generalizes in benign ways (e.g., RLHF with only English labels also tends to produce good behavior in French or Spanish). The hope is that supervising honesty on simple cases generalizes benignly to the model being honest in general.

The author helped introduce a key analogy at OpenAI: instead of a human supervising a superhuman model, can a **small model align a larger (smarter) model**? They found that generalization does actually get you some (but not all) of the intelligence gap between supervisor and supervisee, and there is a lot you can do to improve it.

**Interpretability.** If we could understand what AI systems are thinking, we could verify alignment directly.

- **Mechanistic interpretability**: Fully reverse-engineer large neural networks from the ground up (Chris Olah's team at Anthropic has done pioneering work here). The author worries this may be an intractable problem for superhuman AI systems -- comparable to "fully reverse engineering the human brain" -- and puts it more in the "ambitious moonshot" category.
- **"Top-down" interpretability**: More targeted approaches trying to locate information in a model without full understanding. CCS can identify a "truth direction" in models with only unsupervised data. ROME can directly edit a model's knowledge. Representation Engineering and Inference-time Interventions can detect lying and surgically control behavior on jailbreaking, power-seeking, fairness, truthfulness, and more. The author is increasingly bullish that top-down interpretability techniques will be a powerful tool -- building something like an "AI lie detector" without requiring fundamental breakthroughs in understanding neural nets.
- **Chain-of-thought interpretability**: If early AGIs reason via chains of thought (English "internal monologue"), this would be an incredible boon for interpretability, making it relatively easy to detect egregious alignment failures. Key questions: How do we ensure the CoT remains **legible** (not drifting to unintelligible model-speak)? How do we ensure it is **faithful** (actually reflecting the model's thinking, not post-hoc rationalization)? This direction is "criminally underrated."

**Adversarial testing and measurements.** Critical to stress-test alignment at every step -- encountering every failure mode in the lab before the wild. This requires advancing techniques for automated red-teaming. Early work suggests that "sleeper agents" can survive through safety training, for example. Good measurements of alignment are among the very-highest priority work for alignment research today.

### Automating Alignment Research

Ultimately, we will need to automate alignment research. We cannot solve alignment for true superintelligence directly; the intelligence gap is too vast. Moreover, by the end of the intelligence explosion, after 100 million automated AI researchers have furiously powered through a decade of ML progress, the systems will be much more alien.

But if we manage to align somewhat-superhuman systems enough to trust them, we can leverage millions of automated AI researchers (smarter than the best human AI researchers) to solve alignment for even-more superhuman systems. This will be decisive.

Getting automated alignment right during the intelligence explosion will be extraordinarily high-stakes: going through many years of AI advances in mere months, with little human-time to make the right decisions. Labs should commit a large fraction of compute to automated alignment research (vs. automated capabilities research) during the intelligence explosion.

For every OOM we want to ascend, we will need extremely high confidence in our alignment approaches for that next OOM. The decision to greenlight the next generation of superintelligence will need to be taken as seriously as the decision to launch a military operation.

## Superdefense

"Getting alignment right" should only be the first of many layers of defense. Alignment will be hard; there **will** be failures. We need to be in a position where alignment can fail but failure would not be catastrophic:

- **Security**: Airgapped clusters as the first layer of defense against superintelligence attempting to self-exfiltrate. We will need much more extreme security against model self-exfiltration, from hardware encryption to many-key signoff. Once AGIs can do automated R&D, put them to work on further hardening security.
- **Monitoring**: Advanced monitoring systems leveraging the models themselves -- monitoring model outputs, chains of thought, model-written code, server/network activity, and interactions with researchers. Leveraging some AI systems to "nark" on other AI systems. Employ sophisticated "control" protocols using less powerful but trusted models to protect against subversion from more powerful but less trusted models. May require dedicating as much compute to monitoring as to active model instances.
- **Targeted capability limitations**: Limit the model's capabilities in targeted ways to reduce fallout from failure -- e.g., scrubbing everything related to biology and chemistry from model training to cut off paths to bioweapons.
- **Targeted training method restrictions**: Some ways of training models are inherently riskier. Imitation learning seems relatively safe; long-horizon outcome-based RL seems much more likely to lead to undesirable long-term goals. We should also avoid training against our interpretability methods and monitoring setup. Maintain legible and faithful chains of thought as long as possible. Define these constraints ahead of time and only drop them if absolutely necessary.

These will not be foolproof against true superintelligence, but they buy margin for error. Relax "superdefense" measures only as confidence in alignment techniques grows -- deploying in non-airgapped environments concomitant with confidence.

## Why I'm Optimistic, and Why I'm Scared

### Optimistic

The author is "incredibly bullish" on the technical tractability of superalignment:
- There is tons of low-hanging fruit everywhere in the field
- Deep learning generalizes surprisingly benignly in many situations -- it often just "does the thing we meant" rather than picking up abstruse malign behavior
- At least for the initial AGIs, we have a decent shot at interpretability via chains of thought
- Hacky techniques like representation engineering work surprisingly well as "lie detectors"
- There is a pretty reasonable shot that "the default plan" to align somewhat-superhuman systems will mostly work

### Scared

But it is one thing to speak about a "default plan" in the abstract, and another if the team responsible is you and your 20 colleagues. There is still an incredibly tiny number of people seriously working on this -- maybe a few dozen serious researchers. Nobody is on the ball.

The intelligence explosion will be more like running a war than launching a product. We are not on track for superdefense, for airgapped clusters, or for any of the insanely high-stakes decisions required. No lab has demonstrated much willingness to make costly tradeoffs to get safety right. By default, we will probably stumble into the intelligence explosion and have gone through a few OOMs before people even realize what we have gotten into.

**We're counting way too much on luck here.**
