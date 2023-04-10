<template>
  <div class="popper-arrow" data-popper-arrow></div>
</template>

<style lang="scss" scoped>
.popper-arrow,
.popper-arrow::before {
  transition: background 250ms ease-in-out;
  position: absolute;
  width: calc(10px - 1px);
  height: calc(10px - 1px);
  box-sizing: border-box;
  background: var(--back-color);
}

.popper-arrow {
  visibility: hidden;
  &::before {
    visibility: visible;
    content: '';
    transform: rotate(45deg);
  }
}

.popper[data-popper-placement^='top'] > .popper-arrow {
  bottom: -5px;
  &::before {
    border-right: 1px solid var(--border-color);
    border-bottom: 1px solid var(--border-color);
  }
}

.popper[data-popper-placement^='bottom'] > .popper-arrow {
  top: -5px;
  &::before {
    border-left: 1px solid var(--border-color);
    border-top: 1px solid var(--border-color);
  }
}

.popper[data-popper-placement^='left'] > .popper-arrow {
  right: -5px;
  &::before {
    border-right: 1px solid var(--border-color);
    border-top: 1px solid var(--border-color);
  }
}

.popper[data-popper-placement^='right'] > .popper-arrow {
  left: -5px;
}
</style>
