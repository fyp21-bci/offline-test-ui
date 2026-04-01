import pygame
import numpy as np
import time

pygame.init()

WIDTH = 800
HEIGHT = 800
screen = pygame.display.set_mode((WIDTH, HEIGHT))

clock = pygame.time.Clock()


def generate_static():
    noise = np.random.randint(0,255,(HEIGHT,WIDTH))
    surface = pygame.surfarray.make_surface(
        np.stack([noise]*3,axis=2)
    )
    return surface


def generate_worms():
    img = np.zeros((HEIGHT,WIDTH,3))

    for i in range(200):
        x = np.random.randint(0,WIDTH)
        y = np.random.randint(0,HEIGHT)

        length = np.random.randint(5,20)

        for j in range(length):
            if x+j < WIDTH:
                img[y,x+j] = [200,200,200]

    return pygame.surfarray.make_surface(img)


def flicker(surface, freq):

    period = 1/freq
    on = True

    start = time.time()

    while True:

        if on:
            screen.blit(surface,(0,0))
        else:
            screen.fill((0,0,0))

        pygame.display.flip()

        time.sleep(period/2)

        on = not on

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                return


texture = generate_static()

flicker(texture, 14)