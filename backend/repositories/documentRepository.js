const prisma = require('../lib/prisma');

class DocumentRepository {
  async findById(documentId) {
    return prisma.document.findUnique({ where: { id: documentId } });
  }

  async findByOwner(ownerId) {
    return prisma.document.findMany({
      where: { ownerId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async save(documentId, { yjsState, content, version, title, ownerId }) {
    const data = {
      content,
      yjsState,
      version,
      ...(title !== undefined && { title }),
      ...(ownerId !== undefined && { ownerId }),
    };

    return prisma.document.upsert({
      where: { id: documentId },
      create: {
        id: documentId,
        ...data,
      },
      update: data,
    });
  }

  async listVersions(documentId) {
    return prisma.documentVersion.findMany({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        documentId: true,
        content: true,
        createdAt: true,
      },
    });
  }

  async delete(documentId) {
    return prisma.document.delete({ where: { id: documentId } });
  }
}

module.exports = new DocumentRepository();
