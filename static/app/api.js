async function jget(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return await res.json();
}

export const api = {
  stats: () => jget("/api/stats/"),
  explore: ({ limit, layers }) => jget(`/api/explore/?limit=${limit}&layers=${encodeURIComponent(layers)}`),
  random: (category) => jget(`/api/random/?category=${encodeURIComponent(category)}`),
  search: (q) => jget(`/api/search/?q=${encodeURIComponent(q)}`),
  object: (id) => jget(`/api/object/${encodeURIComponent(id)}/`),
  ephemeris: (id, { start, stop, step = "1d" }) =>
    jget(`/api/object/${encodeURIComponent(id)}/ephemeris/?start=${start}&stop=${stop}&step=${encodeURIComponent(step)}`),
};

