<template>
  <left-sidebar class="files-sidebar">
    <template #body>
      <ul class="nav">
        <li v-for="item in quickLinks" :key="item.type" :class="{ active: item.isChecked }" @click.prevent="openLink(item)">
          <span class="icon" aria-hidden="true">
            <i-lucide:history v-if="item.type === 'RECENTS'" />
          </span>
          <span class="title">{{ item.title }}</span>
        </li>
      </ul>

      <div class="section-title">
        {{ $t('volumes') }}
      </div>
      <div class="volumes">
        <VolumeCard
          v-for="item in volumeLinks" :key="item.fullPath" :title="item.title" :count="item.count || ''" :data="item"
          :used-percent="item.usedPercent || 0" :percent-class="percentClass(item.usedPercent)" :active="item.isChecked"
          :show-progress="item.showProgress" @click="openLink(item)"
        />
      </div>

      <template v-if="favoriteLinks.length">
        <div class="section-title">{{ $t('favorites') }}</div>
        <ul class="nav">
          <li v-for="item in favoriteLinks" :key="item.fullPath" :class="{ active: item.isChecked }" @click.prevent="openLink(item)">
            <span class="title">{{ item.title }}</span>
            <v-icon-button
              :id="'favorite-' + item.fullPath" v-tooltip="$t('actions')" class="sm"
              @click.prevent.stop="showFavoriteMenu(item)"
            >
              <i-material-symbols:more-vert />
            </v-icon-button>
          </li>
        </ul>
      </template>

      <v-dropdown-menu v-model="favoriteMenuVisible" :anchor="'favorite-' + selectedFavorite?.fullPath">
        <div class="dropdown-item" @click="openSetFavoriteAlias(); favoriteMenuVisible = false">{{ $t('rename') }}</div>
        <div class="dropdown-item" @click="removeFavoriteFolder(selectedFavorite!); favoriteMenuVisible = false">
          {{ $t('remove_from_favorites') }}
        </div>
      </v-dropdown-menu>
    </template>
  </left-sidebar>
</template>

<script setup lang="ts">
import VolumeCard from '@/components/storage/VolumeCard.vue'
import { useFilesSidebar } from '@/hooks/files-sidebar'

const {
  quickLinks, volumeLinks, favoriteLinks,
  favoriteMenuVisible, selectedFavorite,
  openLink, showFavoriteMenu, removeFavoriteFolder, openSetFavoriteAlias, percentClass,
} = useFilesSidebar()
</script>
