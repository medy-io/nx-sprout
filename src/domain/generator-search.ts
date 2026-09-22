import type { GeneratorDescriptor } from "./interfaces/generator-descriptor.interface.ts";

export function searchGenerators(
  generators: GeneratorDescriptor[],
  query: string,
): GeneratorDescriptor[] {
  const tokens = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return generators;

  return generators
    .map((generator, index) => ({
      generator,
      index,
      score: scoreGenerator(generator, tokens),
    }))
    .filter((result) => result.score >= 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((result) => result.generator);
}

function scoreGenerator(generator: GeneratorDescriptor, tokens: string[]): number {
  const id = generator.id.toLowerCase();
  const name = generator.name.toLowerCase();
  const collection = generator.collection.toLowerCase();
  const aliases = generator.aliases.map((alias) => alias.toLowerCase());
  const description = generator.description.toLowerCase();
  let score = 0;

  for (const token of tokens) {
    if (id === token || aliases.includes(token)) {
      score += 100;
    } else if (name === token) {
      score += 90;
    } else if (name.startsWith(token)) {
      score += 70;
    } else if (id.includes(token)) {
      score += 50;
    } else if (collection.includes(token)) {
      score += 35;
    } else if (description.includes(token)) {
      score += 20;
    } else if ([id, name, collection, ...aliases].some((value) => isSubsequence(token, value))) {
      score += 10;
    } else {
      return -1;
    }
  }

  return score;
}

function isSubsequence(needle: string, haystack: string): boolean {
  let index = 0;
  for (const character of haystack) {
    if (character === needle[index]) index += 1;
    if (index === needle.length) return true;
  }
  return needle.length === 0;
}
