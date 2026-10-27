# The Next-Token Prediction Objective

> **The question this lecture answers:** what does a language model actually try to do during training?

## 1. The job: guess the next token, everywhere

The model has one move. Given the tokens so far, assign a probability to every vocabulary token for the next position. Do that at every position in the corpus, then score each guess against the token that really appeared.

A corpus behaves like a deck of flashcards. The front is a prefix, meaning the tokens before some position. The back is the token that really came next.

```text
front: "The cat sat"          back: <EOS>
front: "The cat sat on the"   back: mat
front: ""                     back: The        (the first token has an empty prefix)
```

Training does one thing: lower the penalty on the backs of all the cards at once.

The deck analogy breaks in one place. Real flashcards are independent questions. These cards all come from running sentences, and one shared model answers all of them. Improving one answer changes millions of others.

## 2. From one-step guesses to a probability for the whole sequence

The link from one token to a whole text is the hinge of the concept, so it gets the first formula. The lecture runs on these symbols from here on:

| Symbol | Name | Job |
|---|---|---|
| $\theta$ | parameters | the trainable weights; all probabilities depend on them |
| $V$ | vocabulary | the set of token IDs, size $K$ (8 in the course's toy set) |
| $x_{1:T}$ | a document | a sequence of $T$ token IDs from $V$ |
| $x_{<t}$ | prefix | the tokens before position $t$: $(x_1,\dots,x_{t-1})$; empty for $t=1$ |
| $p_\theta(x_t \mid x_{<t})$ | next-step probability | the model's probability for the token at position $t$ given the prefix |
| $L(\theta; x)$ | sequence likelihood | the probability the parameters give the whole observed document |

An autoregressive model regresses each position on the previous ones. It defines the probability of a whole sequence as a product of next-step probabilities:

$$
L(\theta; x) \;=\; p_\theta(x_{1:T}) \;=\; \prod_{t=1}^{T} p_\theta(x_t \mid x_{<t})
$$

In plain English: the probability of the text is the probability you gave the first word, times the probability you gave the second word given the first, and so on to the end. The chain rule of probability makes this factorization legitimate. It is also how the architecture is built.

So the one-step objective is not a weaker stand-in for modeling whole texts. By construction, it is a factorization of the whole-text model, and every position contributes its own training card (Lec2_Opt_Lifecycle2.pdf, "From token losses to sequence likelihood").

## 3. The number the trainer minimizes: corpus mean NLL

**Must know.** A proof question on the quiz asks for this derivation. Lectures 3 to 7 assume this loss is the $F$ being minimized.

Bring back the deck. Document $j = 1$ is our carried object, "The cat sat $\langle$EOS$\rangle$", with $T_1 = 4$ target tokens. The first token is predicted from an empty prefix, and $\langle$EOS$\rangle$ marks the end.

**Step 1: score one prediction.** The per-token loss at position $t$ is the NLL of the observed token:

$$
\ell_t(\theta; x) \;:=\; -\log p_\theta(x_t \mid x_{<t})
$$

**Step 2: turn a product into a sum.** Maximizing the sequence likelihood equals minimizing its negative log. The log of a product is the sum of the logs:

$$
-\log L(\theta;x) \;=\; \sum_{t=1}^{T} \ell_t(\theta; x)
$$

**Step 3: extend to a corpus.** Take a corpus $S$ of $n$ documents and treat the documents as independent observations. That is an assumption, and the course states it as one. Document $j$ has $T_j$ targets, and $M := \sum_{j=1}^n T_j$ counts all target tokens:

$$
f_S(\theta) \;=\; \frac{1}{M}\sum_{j=1}^{n}\sum_{t=1}^{T_j} \ell_t(\theta; x^j)
$$

**Step 4: divide rather than sum.** $M$ is a positive constant, so dividing by it cannot move the minimum. Scaling a function stretches its graph without moving where it bottoms out. Minimizing $f_S$ therefore chooses the same $\theta$ as maximizing the corpus likelihood, and it buys a unit that survives comparison: nats per token.

In one sentence, no symbols: average the penalty of every next-token guess over the whole corpus, one guess per position, shared weights everywhere.

This is where the flashcard analogy pays. The sum over $(j,t)$ is exactly "every card gets graded, and the report is the average grade."

> Takeaway: the next-token objective is the corpus mean of per-position NLL. Its $\theta$ is identical to maximum likelihood on the whole corpus.

## 4. One corpus graded by hand

At its current $\theta$, the model assigns these next-step probabilities to the four positions of document 1: $0.6, 0.3, 0.5, 0.8$. I computed the losses with the shell.

| Position | Prefix | Target | $p_\theta$ | Loss $\ell_t = -\ln p_\theta$ |
|---|---|---|---|---|
| 1 | (empty) | The | 0.60 | 0.5108 |
| 2 | "The" | cat | 0.30 | 1.2040 |
| 3 | "The cat" | sat | 0.50 | 0.6931 |
| 4 | "The cat sat" | $\langle$EOS$\rangle$ | 0.80 | 0.2231 |

$$
f_{S}(\theta) = \frac{0.5108 + 1.2040 + 0.6931 + 0.2231}{4} = 0.6578 \ \text{nats per token}
$$

Two readings. Position 4 is the confident guess: $\langle$EOS$\rangle$ after a complete sentence, probability 0.8, cost 0.2231 nats. Position 2 is the shaky guess: probability 0.3 on "cat", cost 1.2040 nats, about 5.4 times more. The ratio is $-\log$ doing concept #10's work, because loss punishes small probability exponentially. Every number is the log of a probability, so the average compares across positions, documents, and corpora.

## 5. Where cross-entropy attaches: one prefix at a time

**Question.** How is this the same loss as the cross-entropy I already learned?

Do not sum over the corpus position by position. First pool the cards that ask the same question.

Fix one prefix $C$, say "The". It appears in four observed training examples. The next tokens are cat, cat, cat, mat.

| token | count | $q(v)$ | $p(v \mid C)$ | $-\ln p$ |
|---|---|---|---|---|
| cat | 3 | 0.75 | 0.40 | 0.9163 |
| mat | 1 | 0.25 | 0.20 | 1.6094 |

The model spends the remaining 0.40 of its mass on tokens that never follow this prefix. Those terms have $q = 0$, so they add nothing to the loss.[^1]

Average the four per-token losses:

$$
\frac{3(0.9163) + 1(1.6094)}{4} = 1.0896 \ \text{nats}
$$

Pooling by answer gives the same number:

$$
-\!\sum_v q(v)\,\log p(v) \;=\; \mathbb{H}\big(q, p(\cdot|C)\big) \;=\; 1.0896
$$

The left side groups individual NLLs. The middle is the cross-entropy definition from #11. Two bookkeeping routes reach one quantity: averaging card by card, or pooling by answer.

**What it implies.** Suppose the model matched the data frequencies exactly. The loss would stop at the entropy $\mathbb{H}(q) = 0.5623$. The current gap of $0.5272$ nats is exactly $\mathrm{KL}(q\,\|\,p)$. Training on the corpus mean NLL pushes each prefix's cross-entropy toward its data entropy.

> Takeaway: next-token training is cross-entropy applied to pooled prefixes. One $\mathbb H(q, p_\theta(\cdot|C))$ per distinct prefix, weight-summed over the corpus.

[^1]: They still shrink $p(\text{cat})$ and $p(\text{mat})$, because the probabilities sum to one.

## 6. Averages, sums, and one exp away: reading the loss three ways

Three bookkeeping forms describe the same model fit. They differ in unit and in what they resemble.

| Form | What it is | Unit | Floor (best possible) | What it resembles |
|---|---|---|---|---|
| $-\log L(\theta; x)$ | per-document NLL: a sum of $\ell_t$ | nats per document | $\mathbb H$ of that document's true distribution | the total weight of one bag |
| $f_S(\theta)$ | corpus mean token NLL (the training loss) | nats per token | $\mathbb H$ of the data, on average unreachable | average weight per item |
| $\mathrm{PPL} := e^{f_S(\theta)}$ | perplexity: exp of the mean loss | effective number of choices | $e^{\mathbb H}$ | how torn the model's certainty is |

**Optional: why it comes up.** Papers report LM quality as PPL, and the transformation is one line. For the graded document above, $f_S = 0.6578$ nats per token, so $\mathrm{PPL} = e^{0.6578} = 1.93$. On average the model splits its certainty as if hesitating between about two equally plausible tokens.

Uniform prediction over the whole toy vocabulary gives $p = 1/K$ per token, so PPL $= K$ exactly. Here that is 8, the sanity-check ceiling of random guessing.

Sum versus mean: the product of probabilities shrinks with text length. The mean NLL and the PPL stay comparable across documents (Lec2, "Perplexity (PPL)").

## 7. Why one step trains long-range structure

The target is one step away. The input is the entire prefix. Two cards show the difference:

```text
prefix: The keys to the cabinet   target: are    (plural subject governs the verb)
prefix: The key to the cabinets   target: is     (singular subject governs the verb)
```

The verb agrees with the subject three words back, not with the nearest noun "cabinet". To lower the loss on these two cards, the model must learn relations across the whole context. The one-step target rewards long-range dependence (Lec2, "The next token can depend on distant words", citing Linzen, Dupoux & Goldberg 2016).

Every card feeds the same $\theta$. "The keys to the cabinet are", "The dogs near the house are" and "The key to the cabinets is" all pull the same weights. That is why one small model absorbs millions of questions.

## 8. The same recipe, run forward or with a hole

Two families supply targets from raw text. Compare them before the quiz names either.

| | GPT-style next-token | BERT-style masked prediction |
|---|---|---|
| What the model sees | only tokens before the target | the whole input, with a token blanked ($\tilde x$) |
| Where the target comes from | the token that actually came next, at every position | the original value of the hidden token, e.g. $\ell_2 = -\log p_\theta(2 \mid \tilde x)$ |
| What it enforces | a probability model of whole sequences (Section 2) | a probability for each position given both sides |
| Downstream use | generate by sampling, one token per step | add a task classifier and fine-tune |

**Optional: why it comes up.** Lecture 2 uses the contrast to place "next-token" among text-only objectives. The masked variant breaks the autoregressive factorization by design, because it predicts one position from both sides (BERT; Devlin et al. 2019). So it is not a model of sequences in the Section 2 sense. Its per-position loss still uses the same $-\log$ scoring.

## 9. Where the objective's claims end

After training reaches a low loss, you know one thing: on training text, the model gives per-token NLL averaging $f_S(\theta)$. You do not know what loss it would reach on text it never saw. Training loss and test loss can separate widely, and that gap is concept #13, the next one on your path.

Two further cautions, stated precisely.

First, during training the prefix is always true text, never the model's own earlier guesses. The model consumes its own output only at generation time. A model can score well on true prefixes and still drift when it feeds on itself.

Second, the floor $\mathbb{H}(q)$ is an average property of the data distribution. Text is not a die with fixed probabilities per prefix, so a perfect-model floor is a useful picture that no finite model attains.

> Takeaway: a low $f_S$ certifies only the text you trained on. Transfer to unseen text is a separate question with its own concept.
