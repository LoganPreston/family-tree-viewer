<template>
  <div class="stats-overlay" @click.self="$emit('close')">
    <div class="stats-modal">
      <div class="stats-header">
        <h2>Tree Statistics</h2>
        <button class="close-btn" @click="$emit('close')">&times;</button>
      </div>
      <div class="stats-content">

        <div class="stats-section">
          <h3>Overview</h3>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-value">{{ stats.total }}</div>
              <div class="stat-label">Total people</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">{{ stats.withBirthDate }}</div>
              <div class="stat-label">Known birth dates</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">{{ stats.withDeathDate }}</div>
              <div class="stat-label">Known death dates</div>
            </div>
          </div>
          <div class="stats-grid gender-grid">
            <div class="stat-card male">
              <div class="stat-value">{{ stats.genderM }}</div>
              <div class="stat-label">Male</div>
            </div>
            <div class="stat-card female">
              <div class="stat-value">{{ stats.genderF }}</div>
              <div class="stat-label">Female</div>
            </div>
            <div class="stat-card unknown">
              <div class="stat-value">{{ stats.genderU }}</div>
              <div class="stat-label">Unknown gender</div>
            </div>
          </div>
        </div>

        <div class="stats-section">
          <h3>Lifespan</h3>
          <div class="stat-row" v-if="stats.oldest">
            <span class="stat-row-label">Oldest (earliest birth)</span>
            <span class="stat-row-value clickable" @click="navigate(stats.oldest!.id)">
              {{ stats.oldest.name }} <span class="stat-year">b. {{ stats.oldest.birthDate }}</span>
            </span>
          </div>
          <div class="stat-row" v-if="stats.youngest">
            <span class="stat-row-label">Youngest (latest birth)</span>
            <span class="stat-row-value clickable" @click="navigate(stats.youngest!.id)">
              {{ stats.youngest.name }} <span class="stat-year">b. {{ stats.youngest.birthDate }}</span>
            </span>
          </div>
        </div>

        <div class="stats-section">
          <h3>Family</h3>
          <div class="stat-row" v-if="stats.mostChildren">
            <span class="stat-row-label">Most children</span>
            <span class="stat-row-value clickable" @click="navigate(stats.mostChildren!.id)">
              {{ stats.mostChildren.name }}
              <span class="stat-year">{{ stats.mostChildren.count }} children</span>
            </span>
          </div>
          <div class="stat-row" v-if="stats.deepestAncestry">
            <span class="stat-row-label">Deepest ancestry line</span>
            <span class="stat-row-value clickable" @click="navigate(stats.deepestAncestry!.id)">
              {{ stats.deepestAncestry.name }}
              <span class="stat-year">{{ stats.deepestAncestry.depth }} generations back</span>
            </span>
          </div>
        </div>

        <div class="stats-section" v-if="stats.byCentury.length > 0">
          <h3>People by birth century</h3>
          <div class="century-bars">
            <div v-for="bucket in stats.byCentury" :key="bucket.century" class="century-row">
              <span class="century-label">{{ bucket.century }}s</span>
              <div class="century-bar-wrap">
                <div class="century-bar" :style="{ width: (bucket.count / stats.byCenturyMax * 100) + '%' }"></div>
              </div>
              <span class="century-count">{{ bucket.count }}</span>
            </div>
          </div>
        </div>

        <div class="stats-section" v-if="stats.topPlaces.length > 0">
          <h3>Top birth places</h3>
          <div class="stat-row" v-for="place in stats.topPlaces" :key="place.name">
            <span class="stat-row-label">{{ place.name }}</span>
            <span class="stat-row-value">{{ place.count }} people</span>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useFamilyTreeStore } from '../stores/family-tree-store';
import { extractYearFromBirthdate } from '../utils/date-utils';

const emit = defineEmits<{ close: [] }>();
const store = useFamilyTreeStore();

function navigate(personId: string) {
  store.setCurrentRoot(personId);
  emit('close');
}

const stats = computed(() => {
  const persons = store.familyTree.persons;

  const total = persons.length;
  const withBirthDate = persons.filter(p => p.birthDate).length;
  const withDeathDate = persons.filter(p => p.deathDate).length;
  const genderM = persons.filter(p => p.gender === 'M').length;
  const genderF = persons.filter(p => p.gender === 'F').length;
  const genderU = persons.filter(p => !p.gender || p.gender === 'U').length;

  // Oldest / youngest
  let oldest: { id: string; name: string; birthDate: string } | null = null;
  let youngest: { id: string; name: string; birthDate: string } | null = null;
  let oldestYear = Infinity;
  let youngestYear = -Infinity;

  for (const p of persons) {
    const year = extractYearFromBirthdate(p.birthDate);
    if (year === null) continue;
    if (year < oldestYear) { oldestYear = year; oldest = { id: p.id, name: p.name, birthDate: p.birthDate! }; }
    if (year > youngestYear) { youngestYear = year; youngest = { id: p.id, name: p.name, birthDate: p.birthDate! }; }
  }

  // Most children
  let mostChildren: { id: string; name: string; count: number } | null = null;
  for (const p of persons) {
    const count = p.relationships.filter(r => r.type === 'child').length;
    if (count > (mostChildren?.count ?? 0)) {
      mostChildren = { id: p.id, name: p.name, count };
    }
  }

  // Deepest ancestry — BFS up parent links from each person, track max depth
  let deepestAncestry: { id: string; name: string; depth: number } | null = null;
  const personMap = new Map(persons.map(p => [p.id, p]));

  for (const p of persons) {
    let depth = 0;
    const visited = new Set<string>();
    const queue = [p.id];
    visited.add(p.id);
    while (queue.length > 0) {
      const next: string[] = [];
      for (const id of queue) {
        const person = personMap.get(id);
        if (!person) continue;
        for (const rel of person.relationships) {
          if (rel.type === 'parent' && !visited.has(rel.personId)) {
            visited.add(rel.personId);
            next.push(rel.personId);
          }
        }
      }
      if (next.length > 0) depth++;
      queue.length = 0;
      queue.push(...next);
    }
    if (depth > (deepestAncestry?.depth ?? 0)) {
      deepestAncestry = { id: p.id, name: p.name, depth };
    }
  }

  // Birth centuries
  const centuryMap = new Map<number, number>();
  for (const p of persons) {
    const year = extractYearFromBirthdate(p.birthDate);
    if (year === null) continue;
    const century = Math.floor(year / 100) * 100;
    centuryMap.set(century, (centuryMap.get(century) ?? 0) + 1);
  }
  const byCentury = [...centuryMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([century, count]) => ({ century, count }));
  const byCenturyMax = Math.max(...byCentury.map(b => b.count), 1);

  // Top birth places (last segment = broadest location)
  const placeMap = new Map<string, number>();
  for (const p of persons) {
    if (!p.birthPlace) continue;
    const parts = p.birthPlace.split(',');
    const region = parts[parts.length - 1].trim();
    if (region) placeMap.set(region, (placeMap.get(region) ?? 0) + 1);
  }
  const topPlaces = [...placeMap.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));

  return {
    total, withBirthDate, withDeathDate,
    genderM, genderF, genderU,
    oldest, youngest,
    mostChildren,
    deepestAncestry,
    byCentury, byCenturyMax,
    topPlaces,
  };
});
</script>

<style scoped>
.stats-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.stats-modal {
  background: white;
  border-radius: 8px;
  padding: 24px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}

.stats-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-shrink: 0;
}

.stats-header h2 { margin: 0; color: #333; }

.close-btn {
  background: none;
  border: none;
  font-size: 28px;
  cursor: pointer;
  color: #999;
  line-height: 1;
  padding: 0;
  width: 32px;
  height: 32px;
}

.close-btn:hover { color: #333; }

.stats-content {
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.stats-section h3 {
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #999;
  margin: 0 0 12px 0;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 10px;
}

.stat-card {
  background: #f5f5f5;
  border-radius: 6px;
  padding: 12px;
  text-align: center;
}

.stat-card.male   { background: #e3f2fd; }
.stat-card.female { background: #fce4ec; }
.stat-card.unknown { background: #f5f5f5; }

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #333;
  line-height: 1;
}

.stat-label {
  font-size: 11px;
  color: #888;
  margin-top: 4px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 7px 0;
  border-bottom: 1px solid #f0f0f0;
  gap: 12px;
}

.stat-row:last-child { border-bottom: none; }

.stat-row-label {
  font-size: 13px;
  color: #666;
  flex-shrink: 0;
}

.stat-row-value {
  font-size: 13px;
  font-weight: 500;
  color: #333;
  text-align: right;
}

.stat-row-value.clickable {
  cursor: pointer;
  color: #2196f3;
}

.stat-row-value.clickable:hover { text-decoration: underline; }

.stat-year {
  font-size: 12px;
  color: #888;
  font-weight: 400;
  margin-left: 6px;
}

.century-bars {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.century-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.century-label {
  font-size: 12px;
  color: #666;
  width: 46px;
  flex-shrink: 0;
}

.century-bar-wrap {
  flex: 1;
  background: #f0f0f0;
  border-radius: 3px;
  height: 14px;
  overflow: hidden;
}

.century-bar {
  height: 100%;
  background: #2196f3;
  border-radius: 3px;
  transition: width 0.3s ease;
  min-width: 2px;
}

.century-count {
  font-size: 12px;
  color: #666;
  width: 32px;
  text-align: right;
  flex-shrink: 0;
}
</style>
