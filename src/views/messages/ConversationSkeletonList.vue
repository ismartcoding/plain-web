<template>
  <div class="scroller">
    <section v-for="i in 20" :key="i" class="conversation-item selectable-card-skeleton">
      <div class="title">
        <div class="skeleton-checkbox checkbox"></div>
        <div class="text">
          <div class="skeleton-text lg" style="width: 50%"></div>
        </div>
        <div class="time">
          <div class="skeleton-text" style="width: 60px"></div>
        </div>
      </div>
      <div class="subtitle">
      <span class="number">{{ i }}</span>
        <div class="skeleton-text" style="width: 70%"></div>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.scroller {
  overflow-y: auto;
  overflow-x: hidden;
  flex: 1;
}
</style>
