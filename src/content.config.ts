import { defineCollection } from 'astro:content';
import { file } from 'astro/loaders';
import { z } from 'astro/zod';
import YAML from 'yaml';

// YAML 預設遇到重複 key 會丟錯；loader 只會吞成一行 log，這裡把原因印清楚
function parseYaml(text: string) {
  try {
    return YAML.parse(text);
  } catch (e) {
    console.error(`\n[資料錯誤] ${(e as Error).message}\n`);
    throw e;
  }
}

const location = z.strictObject({
  name: z.string(),
  address: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  approx: z.boolean().optional(),
});

const common = {
  category: z.string(),
  notes: z.string().optional(),
  intro: z.string().optional(),
  caution: z.string().optional(),
  regions: z.array(z.string()).optional(),
  website: z.url().optional(),
  sources: z.array(z.url()).optional(),
  locations: z.array(location).optional(),
  verified: z.boolean().default(false),
};

const restaurants = defineCollection({
  loader: file('src/data/restaurants.yaml', { parser: parseYaml }),
  schema: z.strictObject({
    ...common,
    platform: z.string().optional(),
    offer: z.string(),
    value: z.number(),
    period: z.string().optional(),
  }),
});

const shops = defineCollection({
  loader: file('src/data/shops.yaml', { parser: parseYaml }),
  schema: z.strictObject({
    ...common,
    minSpend: z.number().optional(),
    discount: z.number(),
  }),
});

const platforms = defineCollection({
  loader: file('src/data/platforms.yaml', { parser: parseYaml }),
  schema: z.strictObject({
    intro: z.string(),
    url: z.url().optional(),
  }),
});

export const collections = { restaurants, shops, platforms };
